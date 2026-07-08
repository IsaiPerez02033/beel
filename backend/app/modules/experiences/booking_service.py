"""Lógica de negocio para reservas de experiencias (bookings)."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.modules.experiences.models import Experience, ExperienceBooking
from app.modules.experiences.schemas import (
    ExperienceBookingCancelIn,
    ExperienceBookingCreateIn,
    ExperienceBookingRespondIn,
    ExperiencePriceBreakdownOut,
)
from app.modules.reservations.service import _calculate_host_retention
from app.modules.users.models import User

logger = logging.getLogger(__name__)


# ── Precios ──────────────────────────────────────────────────────────────────

def _calculate_experience_price(
    experience: Experience, participants: int
) -> ExperiencePriceBreakdownOut:
    """Desglose de precio para una reserva de experiencia (modelo Airbnb)."""
    price_per_person = experience.price_per_person
    subtotal = price_per_person * participants
    platform_fee = round(subtotal * Decimal(str(settings.PLATFORM_FEE_PERCENTAGE / 100)), 2)
    # IVA del servicio: se suma al total del huésped y se le pasa al anfitrión.
    lodging_iva = round(subtotal * Decimal(str(settings.LODGING_IVA_PERCENTAGE / 100)), 2)
    total = subtotal + platform_fee + lodging_iva
    return ExperiencePriceBreakdownOut(
        participants=participants,
        price_per_person=price_per_person,
        subtotal=subtotal,
        platform_fee=platform_fee,
        lodging_iva=lodging_iva,
        total=total,
        currency=experience.currency,
    )


async def get_price_breakdown(
    db: AsyncSession, experience_id: uuid.UUID, participants: int
) -> ExperiencePriceBreakdownOut:
    result = await db.execute(
        select(Experience).where(Experience.id == experience_id, Experience.status == "active")
    )
    experience = result.scalar_one_or_none()
    if not experience:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    return _calculate_experience_price(experience, participants)


# ── Consultas ────────────────────────────────────────────────────────────────

def _booking_query():
    return select(ExperienceBooking).options(
        selectinload(ExperienceBooking.experience).selectinload(Experience.photos),
        selectinload(ExperienceBooking.guest),
        selectinload(ExperienceBooking.host),
    )


async def get_booking(db: AsyncSession, booking_id: uuid.UUID) -> Optional[ExperienceBooking]:
    result = await db.execute(_booking_query().where(ExperienceBooking.id == booking_id))
    return result.scalar_one_or_none()


# ── Crear ────────────────────────────────────────────────────────────────────

async def create_booking(
    db: AsyncSession, guest: User, data: ExperienceBookingCreateIn
) -> ExperienceBooking:
    result = await db.execute(
        select(Experience)
        .where(Experience.id == data.experience_id, Experience.status == "active")
        .with_for_update()
    )
    experience = result.scalar_one_or_none()
    if not experience:
        raise HTTPException(status_code=404, detail="Experiencia no disponible")

    if experience.host_id == guest.id:
        raise HTTPException(status_code=400, detail="No puedes reservar tu propia experiencia")

    if data.participants < experience.min_participants:
        raise HTTPException(
            status_code=400,
            detail=f"El mínimo de participantes es {experience.min_participants}",
        )
    if data.participants > experience.max_participants:
        raise HTTPException(
            status_code=400,
            detail=f"El máximo de participantes es {experience.max_participants}",
        )

    breakdown = _calculate_experience_price(experience, data.participants)

    host_rfc = (
        await db.execute(select(User.rfc).where(User.id == experience.host_id))
    ).scalar_one_or_none()
    host_has_rfc = bool(host_rfc)
    ret_base = breakdown.subtotal
    ret = _calculate_host_retention(ret_base, host_has_rfc)
    host_net_payout = ret_base + breakdown.lodging_iva - ret["isr"] - ret["iva"]

    instant = experience.instant_booking
    host_deadline = (
        datetime.now(timezone.utc) + timedelta(hours=settings.RESERVATION_REQUEST_TIMEOUT_HOURS)
        if not instant else None
    )
    initial_status = "confirmed" if instant else "pending"

    booking = ExperienceBooking(
        experience_id=experience.id,
        guest_id=guest.id,
        host_id=experience.host_id,
        booking_date=data.booking_date,
        start_time=data.start_time,
        participants=data.participants,
        price_per_person_snapshot=breakdown.price_per_person,
        subtotal=breakdown.subtotal,
        platform_fee_snapshot=breakdown.platform_fee,
        platform_fee_pct=Decimal(str(settings.PLATFORM_FEE_PERCENTAGE)),
        total_amount=breakdown.total,
        currency=breakdown.currency,
        lodging_iva_snapshot=breakdown.lodging_iva,
        host_has_rfc=host_has_rfc,
        isr_retention_pct=ret["isr_pct"],
        iva_retention_pct=ret["iva_pct"],
        isr_retention_snapshot=ret["isr"],
        iva_retention_snapshot=ret["iva"],
        host_net_payout=host_net_payout,
        cancellation_policy_snapshot=experience.cancellation_policy,
        status=initial_status,
        guest_message=data.guest_message,
        host_response_deadline=host_deadline,
    )
    db.add(booking)
    await db.flush()

    if initial_status == "confirmed":
        booking.payout_scheduled_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.PAYOUT_DELAY_HOURS
        )
        experience.total_bookings += 1

    await db.flush()

    # Notificaciones en la app (no rompen el flujo)
    try:
        from app.modules.notifications.service import create_notification
        notif_data = {"experience_booking_id": str(booking.id), "experience_id": str(experience.id)}
        if initial_status == "confirmed":
            await create_notification(
                db, user_id=experience.host_id, type="experience_booking_confirmed",
                title="¡Nueva reserva de experiencia!",
                body=f"{guest.full_name} reservó {experience.title} ({data.booking_date}).",
                data=notif_data,
            )
        else:
            await create_notification(
                db, user_id=experience.host_id, type="experience_booking_request",
                title="Nueva solicitud de experiencia",
                body=f"{guest.full_name} quiere reservar {experience.title} ({data.booking_date}).",
                data=notif_data,
            )
    except Exception as e:
        logger.error("Error al notificar booking de experiencia: %s", e)

    logger.info("Booking de experiencia %s creado (%s)", booking.id, initial_status)
    return await get_booking(db, booking.id)


# ── Responder / cancelar ─────────────────────────────────────────────────────

async def respond_to_booking(
    db: AsyncSession, booking: ExperienceBooking, host: User,
    data: ExperienceBookingRespondIn,
) -> ExperienceBooking:
    if booking.host_id != host.id:
        raise HTTPException(status_code=403, detail="No eres el anfitrión de esta reserva")
    if booking.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"La reserva está en estado '{booking.status}' y no puede responderse",
        )

    if data.action == "confirm":
        booking.status = "confirmed"
        booking.host_message = data.message
        booking.payout_scheduled_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.PAYOUT_DELAY_HOURS
        )
        booking.experience.total_bookings += 1
    else:
        booking.status = "rejected"
        booking.rejection_reason = data.rejection_reason
        booking.host_message = data.message

    await db.flush()

    try:
        from app.modules.notifications.service import create_notification
        notif_data = {"experience_booking_id": str(booking.id), "experience_id": str(booking.experience_id)}
        if booking.status == "confirmed":
            await create_notification(
                db, user_id=booking.guest_id, type="experience_booking_accepted",
                title="Solicitud aceptada",
                body=f"Tu reserva de {booking.experience.title} fue aceptada. Completa el pago.",
                data=notif_data,
            )
        else:
            await create_notification(
                db, user_id=booking.guest_id, type="experience_booking_rejected",
                title="Solicitud rechazada",
                body=f"Tu solicitud de {booking.experience.title} fue rechazada.",
                data=notif_data,
            )
    except Exception as e:
        logger.error("Error al notificar respuesta de booking: %s", e)

    logger.info("Booking %s → %s por host %s", booking.id, booking.status, host.id)
    return booking


async def cancel_booking(
    db: AsyncSession, booking: ExperienceBooking, cancelled_by: User,
    data: ExperienceBookingCancelIn,
) -> ExperienceBooking:
    is_guest = booking.guest_id == cancelled_by.id
    is_host = booking.host_id == cancelled_by.id
    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar")
    if not booking.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"La reserva en estado '{booking.status}' no puede cancelarse",
        )
    booking.status = "cancelled_guest" if is_guest else "cancelled_host"
    booking.cancellation_reason = data.reason
    await db.flush()
    logger.info("Booking %s cancelado por %s", booking.id, cancelled_by.id)
    return booking


# ── Listados ─────────────────────────────────────────────────────────────────

async def list_guest_bookings(
    db: AsyncSession, guest_id: uuid.UUID, status_filter: Optional[str] = None,
    page: int = 1, per_page: int = 10,
):
    query = _booking_query().where(ExperienceBooking.guest_id == guest_id)
    count_q = select(func.count()).where(ExperienceBooking.guest_id == guest_id)
    if status_filter:
        query = query.where(ExperienceBooking.status == status_filter)
        count_q = count_q.where(ExperienceBooking.status == status_filter)
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(ExperienceBooking.booking_date.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_host_bookings(
    db: AsyncSession, host_id: uuid.UUID, status_filter: Optional[str] = None,
    page: int = 1, per_page: int = 10,
):
    query = _booking_query().where(ExperienceBooking.host_id == host_id)
    count_q = select(func.count()).where(ExperienceBooking.host_id == host_id)
    if status_filter:
        query = query.where(ExperienceBooking.status == status_filter)
        count_q = count_q.where(ExperienceBooking.status == status_filter)
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(ExperienceBooking.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total
