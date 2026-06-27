import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.notifications import service
from app.modules.notifications.schemas import NotificationListOut, NotificationOut

router = APIRouter()


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    current_user: CurrentUser,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Retorna las notificaciones del usuario autenticado."""
    notifs, total, unread = await service.list_notifications(
        db, current_user.id, limit=limit, offset=offset
    )
    return NotificationListOut(notifications=notifs, total=total, unread_count=unread)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Marca una notificación como leída."""
    notif = await service.mark_notification_read(db, current_user.id, notification_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await db.commit()
    return notif


@router.post("/read-all")
async def mark_all_read(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Marca todas las notificaciones del usuario como leídas."""
    count = await service.mark_all_read(db, current_user.id)
    await db.commit()
    return {"marked_read": count}

