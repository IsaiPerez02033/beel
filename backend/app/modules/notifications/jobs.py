"""Trabajos periódicos de notificaciones automáticas.

Corre como task de asyncio dentro del proceso de la API (se arranca en el
lifespan de main.py). Suficiente para una sola instancia en Render; si algún
día hay varias instancias, mover esto a un worker dedicado.

Trabajo actual:
  - Recordatorio de pago abandonado: pagos con status='pending' creados hace
    entre 1 y 24 horas cuya reserva sigue viva → notificación (in-app + push)
    al huésped para que termine su reservación. Se envía UNA sola vez por pago
    (se deduplica contra la tabla notifications por data->>'payment_id').
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import String, cast, select

from app.modules.notifications.models import Notification

logger = logging.getLogger(__name__)

# Cada cuánto corre el ciclo completo de trabajos
INTERVAL_SECONDS = 15 * 60
# Ventana del recordatorio: ni muy pronto (aún puede estar pagando) ni tan
# tarde que la reserva ya no tenga sentido.
REMIND_AFTER = timedelta(hours=1)
REMIND_BEFORE = timedelta(hours=24)


async def remind_abandoned_payments(db) -> int:
    """Notifica a huéspedes con un pago pendiente abandonado. Devuelve cuántos."""
    from app.modules.notifications.service import create_notification
    from app.modules.payments.models import Payment

    now = datetime.now(timezone.utc)

    already_reminded = (
        select(Notification.id)
        .where(
            Notification.type == "payment_reminder",
            Notification.data["payment_id"].astext == cast(Payment.id, String),
        )
        .exists()
    )

    result = await db.execute(
        select(Payment)
        .where(
            Payment.status == "pending",
            Payment.created_at <= now - REMIND_AFTER,
            Payment.created_at >= now - REMIND_BEFORE,
            ~already_reminded,
        )
        .limit(200)
    )
    payments = result.scalars().all()

    sent = 0
    for payment in payments:
        try:
            if payment.reservation is not None:
                res = payment.reservation
                if res.status not in ("pending", "confirmed"):
                    continue  # cancelada/rechazada: ya no aplica
                guest_id = res.guest_id
                title_obj = res.reservation_property.title if res.reservation_property else "tu hospedaje"
                data = {
                    "payment_id": str(payment.id),
                    "reservation_id": str(res.id),
                    "property_id": str(res.property_id),
                }
            elif payment.experience_booking is not None:
                booking = payment.experience_booking
                if booking.status not in ("pending", "confirmed"):
                    continue
                guest_id = booking.guest_id
                title_obj = booking.experience.title if booking.experience else "tu experiencia"
                data = {
                    "payment_id": str(payment.id),
                    "experience_booking_id": str(booking.id),
                }
            else:
                continue

            await create_notification(
                db,
                user_id=guest_id,
                type="payment_reminder",
                title="Tu reservación te está esperando",
                body=f"Te quedaste a un paso de reservar {title_obj}. Completa tu pago para asegurar tus fechas.",
                data=data,
                send_email=False,
            )
            sent += 1
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudo recordar el pago %s: %s", payment.id, e)

    if sent:
        await db.commit()
        logger.info("Recordatorios de pago abandonado enviados: %s", sent)
    return sent


async def _run_cycle() -> None:
    from app.core import database

    if not database.AsyncSessionLocal:
        return
    async with database.AsyncSessionLocal() as db:
        try:
            await remind_abandoned_payments(db)
        except Exception:  # noqa: BLE001
            logger.exception("Fallo el ciclo de trabajos de notificaciones")
            await db.rollback()


async def notification_jobs_loop() -> None:
    """Loop infinito de trabajos periódicos. Cancelable desde el lifespan."""
    # Espera inicial corta para no competir con el arranque del servicio
    await asyncio.sleep(120)
    while True:
        await _run_cycle()
        await asyncio.sleep(INTERVAL_SECONDS)
