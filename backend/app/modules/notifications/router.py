import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.notifications import service
from app.modules.notifications.models import PushSubscription
from app.modules.notifications.schemas import (
    BroadcastIn,
    NotificationListOut,
    NotificationOut,
    PushSubscribeIn,
    PushUnsubscribeIn,
)

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


# ── Admin: difusión de avisos ─────────────────────────────────────────────────

@router.post("/admin/broadcast")
async def admin_broadcast(
    data: BroadcastIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Envía un aviso (in-app + web push) a todos los usuarios activos. Solo admin."""
    from app.modules.users.models import User

    me = (await db.execute(select(User).where(User.id == current_user.id))).scalar_one_or_none()
    if not me or me.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores de Beel")

    query = select(User.id).where(User.is_active.is_(True))
    if data.audience == "hosts":
        query = query.where(User.role.in_(["host", "admin"]))
    elif data.audience == "guests":
        query = query.where(User.role == "guest")
    result = await db.execute(query)
    user_ids = [row[0] for row in result.all()]

    count = 0
    for uid in user_ids:
        try:
            await service.create_notification(
                db,
                user_id=uid,
                type=data.type,
                title=data.title,
                body=data.body,
                data={"url": data.url} if data.url else None,
            )
            count += 1
        except Exception:  # noqa: BLE001
            continue
    await db.commit()
    return {"sent": count, "total_users": len(user_ids)}


# ── Web Push ──────────────────────────────────────────────────────────────────

@router.post("/push-subscribe", status_code=201)
async def push_subscribe(
    request: Request,
    data: PushSubscribeIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Registra (o reasigna) la suscripción Web Push del dispositivo."""
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    sub = result.scalar_one_or_none()
    ua = (request.headers.get("user-agent") or "")[:255]
    if sub:
        sub.user_id = current_user.id
        sub.p256dh = data.keys.p256dh
        sub.auth = data.keys.auth
        sub.user_agent = ua
    else:
        sub = PushSubscription(
            user_id=current_user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth=data.keys.auth,
            user_agent=ua,
        )
        db.add(sub)
    await db.commit()
    return {"subscribed": True}


@router.delete("/push-subscribe")
async def push_unsubscribe(
    data: PushUnsubscribeIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Elimina la suscripción Web Push del dispositivo (solo la propia)."""
    result = await db.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint,
            PushSubscription.user_id == current_user.id,
        )
    )
    await db.commit()
    return {"unsubscribed": bool(result.rowcount)}

