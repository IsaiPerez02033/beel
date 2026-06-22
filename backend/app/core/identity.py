"""
Verificación de identidad (KYC) con Didit.

Flujo:
  1. create_session(user) → crea una sesión y retorna la URL donde el usuario
     escanea su documento (INE/pasaporte) y hace la verificación facial (liveness).
  2. El usuario completa el flujo en la página hospedada de Didit.
  3. Didit envía un webhook con el resultado → handle_webhook() actualiza la BD.

Documentos soportados según el país los detecta Didit automáticamente
(INE/IFE y pasaporte para México, etc.).

Config (.env):
    DIDIT_API_KEY=xxxxx
    DIDIT_WORKFLOW_ID=xxxxx
    DIDIT_WEBHOOK_SECRET=xxxxx
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def didit_configured() -> bool:
    return bool(settings.DIDIT_API_KEY and settings.DIDIT_WORKFLOW_ID)


async def create_session(user_id: str, callback_url: str) -> dict:
    """
    Crea una sesión de verificación en Didit.
    Retorna {session_id, url} — la url es donde redirigir al usuario.
    """
    if not didit_configured():
        raise RuntimeError("Didit no está configurado.")

    payload = {
        "workflow_id": settings.DIDIT_WORKFLOW_ID,
        "vendor_data": user_id,           # nos lo devuelven en el webhook
        "callback": callback_url,         # a dónde regresa el usuario al terminar
    }
    headers = {
        "x-api-key": settings.DIDIT_API_KEY,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{settings.DIDIT_BASE_URL}/v2/session/",
            json=payload,
            headers=headers,
        )

    if resp.status_code not in (200, 201):
        logger.error("Didit create_session error [%s]: %s", resp.status_code, resp.text)
        raise RuntimeError("No se pudo iniciar la verificación de identidad.")

    data = resp.json()
    return {
        "session_id": data.get("session_id"),
        "url": data.get("url") or data.get("verification_url"),
    }


def verify_webhook(
    raw_body: bytes,
    headers: dict,
) -> tuple[bool, str]:
    """
    Valida un webhook de Didit v3 según la especificación oficial.

    Verifica (en orden):
      1. X-Timestamp fresco (≤ 300 s)
      2. Firma HMAC-SHA256 — soporta los 3 esquemas de Didit:
         - X-Signature-V2: sobre el JSON canónico ordenado (recomendado)
         - X-Signature: sobre los bytes crudos del body
         - X-Signature-Simple: sobre "{ts}:{session_id}:{status}:{webhook_type}"

    Retorna (válido, motivo). Comparación en tiempo constante.
    """
    if not settings.DIDIT_WEBHOOK_SECRET:
        return False, "secret no configurado"

    secret = settings.DIDIT_WEBHOOK_SECRET.encode()

    # Headers case-insensitive
    h = {k.lower(): v for k, v in headers.items()}
    ts = h.get("x-timestamp", "")
    sig_v2 = h.get("x-signature-v2", "")
    sig_raw = h.get("x-signature", "")
    sig_simple = h.get("x-signature-simple", "")

    # 1. Validar frescura del timestamp (anti-replay)
    if ts:
        try:
            if abs(time.time() - int(ts)) > 300:
                return False, "timestamp expirado"
        except (ValueError, TypeError):
            return False, "timestamp inválido"

    def _hmac(msg: bytes) -> str:
        return hmac.new(secret, msg, hashlib.sha256).hexdigest()

    # 2a. X-Signature-V2 — JSON canónico ordenado, Unicode preservado
    if sig_v2:
        try:
            parsed = json.loads(raw_body)
            canonical = json.dumps(
                parsed, sort_keys=True, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            if hmac.compare_digest(_hmac(canonical), sig_v2):
                return True, "v2"
        except Exception:
            pass

    # 2b. X-Signature — bytes crudos (Didit → backend directo, sin re-encode)
    if sig_raw and hmac.compare_digest(_hmac(raw_body), sig_raw):
        return True, "raw"

    # 2c. X-Signature-Simple — fallback
    if sig_simple:
        try:
            p = json.loads(raw_body)
            msg = f"{ts}:{p.get('session_id','')}:{p.get('status','')}:{p.get('webhook_type','')}"
            if hmac.compare_digest(_hmac(msg.encode()), sig_simple):
                return True, "simple"
        except Exception:
            pass

    return False, "firma inválida"


# Compat: función anterior (mantener por si algo la referencia)
def verify_webhook_signature(body: bytes, signature: str, timestamp: str = "") -> bool:
    ok, _ = verify_webhook(body, {"x-signature": signature, "x-timestamp": timestamp})
    return ok


def parse_webhook_result(payload: dict) -> tuple[Optional[str], str]:
    """
    Extrae (vendor_data/user_id, status) del payload del webhook de Didit v3.
    status normalizado: 'approved' | 'declined' | 'pending'

    En v3 el payload trae 'vendor_data' y 'status' a nivel raíz; algunos
    eventos lo anidan en 'session'. Buscamos en ambos lugares.
    """
    session = payload.get("session") or {}

    user_id = (
        payload.get("vendor_data")
        or session.get("vendor_data")
        or payload.get("metadata", {}).get("vendor_data")
    )

    raw = (
        payload.get("status")
        or session.get("status")
        or payload.get("decision")
        or ""
    )
    raw_status = str(raw).strip().lower()

    if raw_status in ("approved", "approve", "verified", "completed", "success"):
        status = "approved"
    elif raw_status in ("declined", "rejected", "denied", "failed", "abandoned", "expired", "kyc expired"):
        status = "declined"
    else:
        status = "pending"  # not started, in progress, in review

    return user_id, status
