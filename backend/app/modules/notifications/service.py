import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import Notification

logger = logging.getLogger(__name__)


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    send_email: bool = True,
    send_whatsapp: bool = False,
) -> Notification:
    """Crea una notificación en la base de datos."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        data=data,
        send_email=send_email,
        send_whatsapp=send_whatsapp,
        send_in_app=True,
    )
    db.add(notif)
    await db.flush()
    logger.info("Notificación creada: %s para usuario %s (tipo: %s)", notif.id, user_id, type)
    return notif


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Notification], int, int]:
    """Lista las notificaciones de un usuario."""
    # Obtener notificaciones
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    notifications = list(result.scalars().all())

    # Obtener total
    total_stmt = select(func.count()).where(Notification.user_id == user_id)
    total = (await db.execute(total_stmt)).scalar_one()

    # Obtener no leídas
    unread_stmt = select(func.count()).where(
        and_(Notification.user_id == user_id, Notification.is_read.is_(False))
    )
    unread_count = (await db.execute(unread_stmt)).scalar_one()

    return notifications, total, unread_count


async def mark_notification_read(
    db: AsyncSession,
    user_id: uuid.UUID,
    notification_id: uuid.UUID,
) -> Optional[Notification]:
    """Marca una notificación específica como leída."""
    stmt = select(Notification).where(
        and_(Notification.id == notification_id, Notification.user_id == user_id)
    )
    result = await db.execute(stmt)
    notif = result.scalar_one_or_none()
    if notif and not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        await db.flush()
    return notif


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Marca todas las notificaciones del usuario como leídas."""
    now = datetime.now(timezone.utc)
    stmt = (
        update(Notification)
        .where(and_(Notification.user_id == user_id, Notification.is_read.is_(False)))
        .values(is_read=True, read_at=now)
    )
    result = await db.execute(stmt)
    await db.flush()
    return result.rowcount
