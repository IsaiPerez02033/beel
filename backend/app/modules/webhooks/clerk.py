"""
Webhook de Clerk para sincronizar usuarios con la BD de Beel.

Clerk envía eventos firmados con svix. Este router:
  1. Verifica la firma del webhook.
  2. Procesa los eventos user.created y user.updated.

Configuración requerida:
  CLERK_WEBHOOK_SECRET=whsec_... (obtenido en Clerk Dashboard → Webhooks)
"""

import hashlib
import hmac
import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.modules.users import service
from app.modules.users.schemas import ClerkUserCreated

logger = logging.getLogger(__name__)
router = APIRouter()

WEBHOOK_TOLERANCE_SECONDS = 300  # 5 minutos


async def _is_duplicate_clerk_webhook(svix_id: str) -> bool:
    """Verifica si un webhook ya fue procesado usando Redis."""
    if not svix_id:
        return False
    try:
        from app.core.cache import get_cache
        redis = await get_cache()
        key = f"beel:webhook:clerk:{svix_id}"
        exists = await redis.set(key, "1", nx=True, ex=86400)
        return not exists
    except Exception:
        logger.warning("Redis no disponible para idempotencia de webhook Clerk")
        return False


def _verify_clerk_signature(
    payload: bytes,
    headers: dict,
    secret: str,
) -> bool:
    """
    Verifica la firma svix del webhook de Clerk.
    Docs: https://docs.svix.com/receiving/verifying-payloads/how
    """
    svix_id = headers.get("svix-id", "")
    svix_timestamp = headers.get("svix-timestamp", "")
    svix_signature = headers.get("svix-signature", "")

    if not all([svix_id, svix_timestamp, svix_signature]):
        return False

    # Verificar que el timestamp no sea muy antiguo (replay protection)
    try:
        ts = int(svix_timestamp)
        if abs(time.time() - ts) > WEBHOOK_TOLERANCE_SECONDS:
            logger.warning("Webhook timestamp demasiado antiguo: %s", ts)
            return False
    except (ValueError, TypeError):
        return False

    # Construir el mensaje a firmar
    to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode('utf-8')}"

    # La clave viene con prefijo "whsec_", decodificar base64
    import base64
    raw_secret = secret.removeprefix("whsec_")
    key = base64.b64decode(raw_secret)

    # Calcular HMAC-SHA256
    expected_sig = hmac.new(key, to_sign.encode(), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected_sig).decode()

    # Clerk puede enviar múltiples firmas separadas por espacio
    received_sigs = [s.split(",", 1)[-1] for s in svix_signature.split(" ")]
    return expected_b64 in received_sigs


@router.post("/clerk", status_code=status.HTTP_200_OK)
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Endpoint que recibe eventos de Clerk."""
    body = await request.body()
    headers = dict(request.headers)

    # Verificar firma
    if not _verify_clerk_signature(
        payload=body,
        headers=headers,
        secret=settings.CLERK_WEBHOOK_SECRET,
    ):
        logger.warning("Firma de webhook de Clerk inválida")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Firma inválida",
        )

    # Idempotencia: evitar procesar webhooks duplicados
    svix_id = headers.get("svix-id", "")
    if svix_id and await _is_duplicate_clerk_webhook(svix_id):
        logger.info("Webhook Clerk duplicado ignorado: %s", svix_id)
        return {"received": True, "duplicate": True}

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON inválido")

    event_type = event.get("type")
    data = event.get("data", {})

    logger.info("Webhook de Clerk recibido: %s", event_type)

    if event_type in ("user.created", "user.updated"):
        try:
            clerk_user = ClerkUserCreated(**data)
            await service.upsert_user_from_clerk(db, clerk_user)
        except Exception as e:
            logger.exception("Error procesando webhook %s: %s", event_type, e)
            raise HTTPException(status_code=500, detail="Error interno")

    elif event_type == "user.deleted":
        clerk_id = data.get("id")
        if clerk_id:
            user = await service.get_user_by_clerk_id(db, clerk_id)
            if user:
                await service.soft_delete_user(db, user)

    # Retornar 200 para cualquier evento no manejado (evita reintentos de Clerk)
    return {"received": True, "type": event_type}
