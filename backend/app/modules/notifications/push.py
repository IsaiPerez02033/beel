"""Envío de notificaciones Web Push a dispositivos con la PWA instalada.

Best-effort: si VAPID no está configurado o el envío falla, solo se loguea —
la notificación in-app (fila en `notifications`) sigue existiendo.
"""

import asyncio
import json
import logging
import uuid
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.notifications.models import PushSubscription

logger = logging.getLogger(__name__)


def _url_for(type_: str, data: Optional[dict]) -> str:
    """Deriva la URL destino al tocar la notificación según su tipo."""
    data = data or {}
    if type_ == "new_message" and data.get("conversation_id"):
        return f"/mensajes?conv={data['conversation_id']}"
    if type_.startswith("reservation") or type_.startswith("booking"):
        return "/viajes"
    if type_.startswith("payment"):
        return "/viajes"
    return "/"


def _send_one(subscription_info: dict, payload: str) -> None:
    """Llamada síncrona a pywebpush (se ejecuta en un thread)."""
    from pywebpush import webpush

    webpush(
        subscription_info=subscription_info,
        data=payload,
        vapid_private_key=settings.VAPID_PRIVATE_KEY,
        vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
        timeout=10,
    )


async def send_push_to_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    type_: str = "general",
    data: Optional[dict] = None,
) -> int:
    """Envía un Web Push a todas las suscripciones del usuario.

    Devuelve cuántos envíos tuvieron éxito. Borra suscripciones muertas (404/410).
    """
    if not settings.VAPID_PRIVATE_KEY:
        return 0

    result = await db.execute(
        select(PushSubscription).where(PushSubscription.user_id == user_id)
    )
    subs = result.scalars().all()
    if not subs:
        return 0

    payload = json.dumps({
        "title": title,
        "body": (body or "")[:180],
        "url": _url_for(type_, data),
    })

    sent = 0
    dead_ids: list[uuid.UUID] = []
    for sub in subs:
        info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            await asyncio.to_thread(_send_one, info, payload)
            sent += 1
        except Exception as e:  # noqa: BLE001
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):
                # Suscripción expirada/revocada: limpiar
                dead_ids.append(sub.id)
                logger.info("Push subscription muerta (HTTP %s), se elimina: %s", status, sub.id)
            else:
                logger.warning("Error enviando web push a %s: %s", sub.id, e)

    if dead_ids:
        try:
            await db.execute(
                delete(PushSubscription).where(PushSubscription.id.in_(dead_ids))
            )
            await db.flush()
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudieron limpiar suscripciones muertas: %s", e)

    return sent
