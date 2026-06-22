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
import logging
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


def verify_webhook_signature(body: bytes, signature: str, timestamp: str = "") -> bool:
    """
    Valida la firma HMAC-SHA256 del webhook de Didit.
    Didit firma el body crudo con el webhook secret (hex en header x-signature).
    Acepta también el esquema con timestamp por compatibilidad.
    """
    if not settings.DIDIT_WEBHOOK_SECRET:
        return False
    secret = settings.DIDIT_WEBHOOK_SECRET.encode()
    # Esquema principal de Didit: HMAC del body crudo
    sig_body = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if hmac.compare_digest(sig_body, signature):
        return True
    # Fallback: esquema con timestamp.body
    if timestamp:
        msg = f"{timestamp}.{body.decode('utf-8')}".encode()
        sig_ts = hmac.new(secret, msg, hashlib.sha256).hexdigest()
        if hmac.compare_digest(sig_ts, signature):
            return True
    return False


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
