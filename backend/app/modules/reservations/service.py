"""Lógica de negocio para reservaciones y disponibilidad."""

import math
import uuid
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import and_, select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core import email as email_service
from app.modules.reservations.models import Availability, Reservation
from app.modules.reservations.schemas import (
    PriceBreakdownOut,
    ReservationCancelIn,
    ReservationCreateIn,
    ReservationRespondIn,
)
from app.modules.properties.models import Property
from app.modules.users.models import User

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _date_range(start: date, end: date) -> list[date]:
    """Genera lista de fechas [start, end) — excluye el check-out."""
    days = []
    current = start
    while current < end:
        days.append(current)
        current += timedelta(days=1)
    return days


async def _dates_are_available(
    db: AsyncSession, property_id: uuid.UUID, check_in: date, check_out: date
) -> bool:
    """
    Verifica que todas las fechas en [check_in, check_out) estén disponibles.
    Usa SELECT FOR UPDATE para bloquear las filas y evitar race conditions.
    Fechas sin registro en availability se consideran disponibles (default).
    """
    needed_dates = _date_range(check_in, check_out)
    if not needed_dates:
        return False

    result = await db.execute(
        select(Availability)
        .where(
            and_(
                Availability.property_id == property_id,
                Availability.date.in_(needed_dates),
            )
        )
        .with_for_update()
    )
    rows = result.scalars().all()

    # Solo rechazar si hay una fila explícitamente bloqueada
    for r in rows:
        if not r.is_available:
            return False

    return True


async def _block_dates(
    db: AsyncSession,
    property_id: uuid.UUID,
    check_in: date,
    check_out: date,
    reservation_id: uuid.UUID,
) -> None:
    """Marca las fechas como no disponibles en una sola operación bulk."""
    needed_dates = _date_range(check_in, check_out)
    if not needed_dates:
        return

    from sqlalchemy.dialects.postgresql import insert as pg_insert

    values = []
    for d in needed_dates:
        values.append({
            "property_id": property_id,
            "date": d,
            "is_available": False,
            "blocked_reason": "reservation",
            "reservation_id": reservation_id,
        })

    stmt = pg_insert(Availability).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=["property_id", "date"],
        set_={
            "is_available": False,
            "blocked_reason": "reservation",
            "reservation_id": reservation_id,
        },
    )
    await db.execute(stmt)
    await db.flush()


async def _unblock_dates(
    db: AsyncSession, property_id: uuid.UUID, reservation_id: uuid.UUID
) -> None:
    """Libera las fechas bloqueadas por una reserva específica."""
    result = await db.execute(
        select(Availability).where(
            Availability.property_id == property_id,
            Availability.reservation_id == reservation_id,
        )
    )
    for avail in result.scalars().all():
        avail.is_available = True
        avail.blocked_reason = None
        avail.reservation_id = None
    await db.flush()


def _calculate_price(
    property_: Property,
    nights: int,
    availability_overrides: dict[date, Decimal] | None = None,
) -> PriceBreakdownOut:
    """Calcula el desglose de precios para una reserva."""
    price_per_night = property_.price_per_night
    subtotal = price_per_night * nights
    cleaning_fee = property_.cleaning_fee or Decimal("0")
    security_deposit = property_.security_deposit or Decimal("0")
    platform_fee = round(
        subtotal * Decimal(str(settings.PLATFORM_FEE_PERCENTAGE / 100)), 2
    )
    total = subtotal + cleaning_fee + platform_fee

    return PriceBreakdownOut(
        nights=nights,
        price_per_night=price_per_night,
        subtotal=subtotal,
        cleaning_fee=cleaning_fee,
        security_deposit=security_deposit,
        platform_fee=platform_fee,
        total=total,
        currency=property_.currency,
    )


# ── Reservaciones ─────────────────────────────────────────────────────────────

def _reservation_query():
    return select(Reservation).options(
        # Cargar también las fotos del snapshot: PropertySnapshotOut las
        # serializa y un lazy-load fuera del greenlet rompería (MissingGreenlet).
        selectinload(Reservation.reservation_property).selectinload(Property.photos),
        selectinload(Reservation.guest),
        selectinload(Reservation.host),
    )


async def get_reservation(
    db: AsyncSession, reservation_id: uuid.UUID
) -> Optional[Reservation]:
    result = await db.execute(
        _reservation_query().where(Reservation.id == reservation_id)
    )
    return result.scalar_one_or_none()


async def get_price_breakdown(
    db: AsyncSession, property_id: uuid.UUID, check_in: date, check_out: date
) -> PriceBreakdownOut:
    """Calcula el precio para un rango de fechas (sin crear reserva)."""
    result = await db.execute(
        select(Property).where(
            Property.id == property_id,
            Property.status == "active",
        )
    )
    property_ = result.scalar_one_or_none()
    if not property_:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    nights = (check_out - check_in).days
    return _calculate_price(property_, nights)


async def create_reservation(
    db: AsyncSession,
    guest: User,
    data: ReservationCreateIn,
) -> Reservation:
    """
    Crea una reserva.
    - Valida disponibilidad (con lock implícito de la transacción).
    - Si instant_booking=True, confirma automáticamente y bloquea fechas.
    - Si instant_booking=False, queda en 'pending' esperando respuesta del host.
    """
    # Obtener propiedad con lock
    result = await db.execute(
        select(Property)
        .where(Property.id == data.property_id, Property.status == "active")
        .with_for_update(skip_locked=True)
    )
    property_ = result.scalar_one_or_none()
    if not property_:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Propiedad no disponible")

    if property_.host_id == guest.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No puedes reservar tu propia propiedad")

    nights = (data.check_out - data.check_in).days

    # Validar estadía mínima
    if nights < property_.min_stay_nights:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"La estadía mínima es {property_.min_stay_nights} noches",
        )

    if property_.max_stay_nights and nights > property_.max_stay_nights:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"La estadía máxima es {property_.max_stay_nights} noches",
        )

    # Validar capacidad
    if data.guests_count > property_.max_guests:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"La propiedad acepta máximo {property_.max_guests} huéspedes",
        )

    # Validar disponibilidad
    available = await _dates_are_available(db, property_.id, data.check_in, data.check_out)
    if not available:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail="Las fechas seleccionadas no están disponibles",
        )

    # Calcular precios
    breakdown = _calculate_price(property_, nights)

    # Calcular deadline de respuesta del host
    host_deadline = (
        datetime.now(timezone.utc) + timedelta(hours=settings.RESERVATION_REQUEST_TIMEOUT_HOURS)
        if not property_.instant_booking
        else None
    )

    # Estado inicial
    initial_status = "confirmed" if property_.instant_booking else "pending"

    reservation = Reservation(
        property_id=property_.id,
        guest_id=guest.id,
        host_id=property_.host_id,
        check_in=data.check_in,
        check_out=data.check_out,
        guests_count=data.guests_count,
        price_per_night_snapshot=breakdown.price_per_night,
        cleaning_fee_snapshot=breakdown.cleaning_fee,
        security_deposit_snapshot=breakdown.security_deposit,
        platform_fee_snapshot=breakdown.platform_fee,
        subtotal=breakdown.subtotal,
        platform_fee_pct=Decimal(str(settings.PLATFORM_FEE_PERCENTAGE)),
        total_amount=breakdown.total,
        currency=breakdown.currency,
        cancellation_policy_snapshot=property_.cancellation_policy,
        status=initial_status,
        guest_message=data.guest_message,
        host_response_deadline=host_deadline,
    )
    db.add(reservation)
    await db.flush()

    # Bloquear fechas si la reserva quedó confirmada
    if initial_status == "confirmed":
        await _block_dates(db, property_.id, data.check_in, data.check_out, reservation.id)
        # Programar payout
        reservation.payout_scheduled_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.PAYOUT_DELAY_HOURS
        )

    # Actualizar contador
    if initial_status == "confirmed":
        property_.total_bookings += 1
        guest.total_trips += 1

    await db.flush()

    # Refrescar para cargar computed columns + relaciones tras flush
    await db.refresh(reservation, ["nights", "updated_at", "reservation_property", "guest", "host"])

    logger.info(
        "Reserva %s creada (%s) | propiedad=%s guest=%s",
        reservation.id, initial_status, property_.id, guest.id,
    )

    # Notificaciones por email (fire-and-forget, nunca rompen el flujo)
    import asyncio
    if initial_status == "confirmed":
        asyncio.ensure_future(email_service.send_reservation_confirmed_guest(reservation))
        asyncio.ensure_future(email_service.send_reservation_confirmed_host(reservation))
    else:
        asyncio.ensure_future(email_service.send_new_request_host(reservation))

    # Re-consultar con relaciones (incluye reservation_property.photos) para
    # que la serialización de ReservationOut no dispare lazy-load (MissingGreenlet).
    return await get_reservation(db, reservation.id)


async def respond_to_reservation(
    db: AsyncSession,
    reservation: Reservation,
    host: User,
    data: ReservationRespondIn,
) -> Reservation:
    """El host acepta o rechaza una solicitud pendiente."""
    from fastapi import HTTPException

    if reservation.host_id != host.id:
        raise HTTPException(status_code=403, detail="No eres el anfitrión de esta reserva")

    if reservation.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"La reserva está en estado '{reservation.status}' y no puede ser respondida",
        )

    if reservation.host_response_deadline and datetime.now(timezone.utc) > reservation.host_response_deadline:
        reservation.status = "rejected"
        raise HTTPException(
            status_code=400,
            detail="El plazo para responder ha expirado",
        )

    if data.action == "confirm":
        # Verificar disponibilidad (pudo haber cambiado mientras esperaba)
        available = await _dates_are_available(
            db, reservation.property_id, reservation.check_in, reservation.check_out
        )
        if not available:
            raise HTTPException(
                status_code=409,
                detail="Las fechas ya no están disponibles",
            )
        reservation.status = "confirmed"
        reservation.host_message = data.message
        reservation.payout_scheduled_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.PAYOUT_DELAY_HOURS
        )
        await _block_dates(
            db, reservation.property_id,
            reservation.check_in, reservation.check_out,
            reservation.id,
        )
        # Actualizar contadores
        reservation.reservation_property.total_bookings += 1
        reservation.guest.total_trips += 1

    else:  # reject
        reservation.status = "rejected"
        reservation.rejection_reason = data.rejection_reason
        reservation.host_message = data.message

    await db.flush()
    logger.info("Reserva %s → %s por host %s", reservation.id, reservation.status, host.id)

    # Notificaciones por email (fire-and-forget)
    import asyncio
    if reservation.status == "confirmed":
        asyncio.ensure_future(email_service.send_host_accepted_guest(reservation))
        asyncio.ensure_future(email_service.send_reservation_confirmed_host(reservation))

    return reservation


async def cancel_reservation(
    db: AsyncSession,
    reservation: Reservation,
    cancelled_by: User,
    data: ReservationCancelIn,
) -> Reservation:
    """Cancela una reserva (guest o host)."""
    from fastapi import HTTPException

    is_guest = reservation.guest_id == cancelled_by.id
    is_host = reservation.host_id == cancelled_by.id

    if not (is_guest or is_host):
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar esta reserva")

    if not reservation.is_active:
        raise HTTPException(
            status_code=400,
            detail=f"La reserva en estado '{reservation.status}' no puede cancelarse",
        )

    was_confirmed = reservation.status == "confirmed"
    reservation.status = "cancelled_guest" if is_guest else "cancelled_host"
    reservation.cancellation_reason = data.reason

    if was_confirmed:
        await _unblock_dates(db, reservation.property_id, reservation.id)

    await db.flush()
    logger.info("Reserva %s cancelada por %s", reservation.id, cancelled_by.id)
    return reservation


async def list_guest_reservations(
    db: AsyncSession,
    guest_id: uuid.UUID,
    status_filter: Optional[str] = None,
    page: int = 1,
    per_page: int = 10,
):
    """Lista las reservas de un huésped."""
    query = _reservation_query().where(Reservation.guest_id == guest_id)
    if status_filter:
        query = query.where(Reservation.status == status_filter)
    query = query.order_by(Reservation.check_in.desc())

    count_q = select(func.count()).where(Reservation.guest_id == guest_id)
    if status_filter:
        count_q = count_q.where(Reservation.status == status_filter)
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


async def list_host_reservations(
    db: AsyncSession,
    host_id: uuid.UUID,
    status_filter: Optional[str] = None,
    page: int = 1,
    per_page: int = 10,
):
    """Lista las reservas recibidas por un anfitrión."""
    query = _reservation_query().where(Reservation.host_id == host_id)
    if status_filter:
        query = query.where(Reservation.status == status_filter)
    query = query.order_by(Reservation.created_at.desc())

    count_q = select(func.count()).where(Reservation.host_id == host_id)
    if status_filter:
        count_q = count_q.where(Reservation.status == status_filter)
    total = (await db.execute(count_q)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    return list(result.scalars().all()), total


# ── Disponibilidad ────────────────────────────────────────────────────────────

async def get_availability(
    db: AsyncSession,
    property_id: uuid.UUID,
    start: date,
    end: date,
) -> list[Availability]:
    """Retorna disponibilidad para un rango de fechas."""
    result = await db.execute(
        select(Availability).where(
            Availability.property_id == property_id,
            Availability.date >= start,
            Availability.date < end,
        ).order_by(Availability.date)
    )
    return list(result.scalars().all())


async def host_block_dates(
    db: AsyncSession,
    property_id: uuid.UUID,
    dates: list[date],
    reason: str,
) -> int:
    """El host bloquea fechas manualmente."""
    count = 0
    for d in dates:
        result = await db.execute(
            select(Availability).where(
                Availability.property_id == property_id,
                Availability.date == d,
            )
        )
        avail = result.scalar_one_or_none()
        if avail:
            if avail.is_available:
                avail.is_available = False
                avail.blocked_reason = reason
                count += 1
        else:
            db.add(Availability(
                property_id=property_id,
                date=d,
                is_available=False,
                blocked_reason=reason,
            ))
            count += 1
    await db.flush()
    return count


async def host_unblock_dates(
    db: AsyncSession,
    property_id: uuid.UUID,
    dates: list[date],
) -> int:
    """El host desbloquea fechas (solo las que él bloqueó, no reservas)."""
    count = 0
    for d in dates:
        result = await db.execute(
            select(Availability).where(
                Availability.property_id == property_id,
                Availability.date == d,
                Availability.blocked_reason.in_(["host_block", "maintenance"]),
            )
        )
        avail = result.scalar_one_or_none()
        if avail:
            avail.is_available = True
            avail.blocked_reason = None
            count += 1
    await db.flush()
    return count


async def generate_availability_horizon(
    db: AsyncSession,
    property_id: uuid.UUID,
    horizon_days: int = None,
) -> int:
    """
    Genera filas de disponibilidad para los próximos N días.
    Llamado al crear una propiedad o bajo demanda.
    """
    if horizon_days is None:
        horizon_days = settings.AVAILABILITY_HORIZON_DAYS

    today = date.today()
    end = today + timedelta(days=horizon_days)
    count = 0

    current = today
    while current < end:
        result = await db.execute(
            select(Availability).where(
                Availability.property_id == property_id,
                Availability.date == current,
            )
        )
        if not result.scalar_one_or_none():
            db.add(Availability(property_id=property_id, date=current, is_available=True))
            count += 1
        current += timedelta(days=1)

    await db.flush()
    logger.info("Horizonte de disponibilidad generado: %d días para %s", count, property_id)
    return count
