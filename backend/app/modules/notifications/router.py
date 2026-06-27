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


@router.post("/test-email")
async def test_email(key: str = Query(...)):
    """Endpoint temporal para probar el envío de emails. Requiere ?key=DEMO_SEED_KEY."""
    from app.core.config import settings
    from app.core.email import _send
    if key != settings.DEMO_SEED_KEY:
        raise HTTPException(status_code=403, detail="Clave inválida")
    await _send(
        to_email="aramperez57@gmail.com",
        to_name="Isai Perez",
        subject="✓ Prueba de email — Beel",
        html="""
        <div style="font-family:Arial,sans-serif;padding:32px;background:#F1EFE8;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
            <h1 style="color:#147A5C;font-size:24px;margin:0 0 16px;">
              ¡Los emails de Beel funcionan! 🎉
            </h1>
            <p style="color:#5C5A57;font-size:15px;line-height:1.6;">
              Este es un correo de prueba enviado desde <strong>beel</strong>.
              Si lo recibes, el sistema de notificaciones por email está
              correctamente configurado.
            </p>
            <p style="color:#9C9A96;font-size:13px;margin-top:24px;">
              — Equipo Beel
            </p>
          </div>
        </div>
        """,
    )
    return {"ok": True, "sent_to": "aramperez57@gmail.com"}
