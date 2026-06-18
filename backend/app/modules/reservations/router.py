"""Router de reservaciones y disponibilidad."""

import uuid
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.reservations import service
from app.modules.reservations.schemas import (
    AvailabilityRangeOut,
    BlockDatesIn,
    PriceBreakdownOut,
    ReservationCancelIn,
    ReservationCreateIn,
    ReservationListOut,
    ReservationOut,
    ReservationRespondIn,
    UnblockDatesIn,
)
from app.modules.users import service as user_service
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Precio y disponibilidad (públicos) ────────────────────────────────────────

@router.get("/availability/{property_id}", response_model=AvailabilityRangeOut)
async def get_availability(
    property_id: uuid.UUID,
    start: date = Query(..., description="Inicio del rango YYYY-MM-DD"),
    end: date = Query(..., description="Fin del rango YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna disponibilidad de una propiedad para un rango de fechas.
    Usado por el calendario del widget de reserva.
    """
    if (end - start).days > 365:
        raise HTTPException(status_code=400, detail="El rango máximo es de 365 días")
    days = await service.get_availability(db, property_id, start, end)
    return AvailabilityRangeOut(property_id=property_id, days=days)


@router.get("/price-breakdown", response_model=PriceBreakdownOut)
async def price_breakdown(
    property_id: uuid.UUID = Query(...),
    check_in: date = Query(...),
    check_out: date = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Calcula el desglose de precios sin crear la reserva."""
    if check_out <= check_in:
        raise HTTPException(status_code=400, detail="La salida debe ser posterior a la llegada")
    return await service.get_price_breakdown(db, property_id, check_in, check_out)


# ── CRUD de reservaciones ─────────────────────────────────────────────────────

@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def create_reservation(
    request: Request,
    data: ReservationCreateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Crea una reserva. Si la propiedad es instant_booking, queda confirmada de inmediato."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return await service.create_reservation(db, user, data)


@router.get("/my-trips", response_model=ReservationListOut)
async def my_trips(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: CurrentUser = ...,
    db: AsyncSession = Depends(get_db),
):
    """Lista los viajes del huésped autenticado."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    reservations, total = await service.list_guest_reservations(
        db, user.id, status_filter, page, per_page
    )
    return ReservationListOut(
        reservations=reservations, total=total, page=page, per_page=per_page
    )


@router.get("/host-requests", response_model=ReservationListOut)
async def host_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    current_user: CurrentUser = ...,
    db: AsyncSession = Depends(get_db),
):
    """Lista las reservas recibidas por el anfitrión autenticado."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user or not user.is_host:
        raise HTTPException(status_code=403, detail="Solo anfitriones pueden acceder")
    reservations, total = await service.list_host_reservations(
        db, user.id, status_filter, page, per_page
    )
    return ReservationListOut(
        reservations=reservations, total=total, page=page, per_page=per_page
    )


@router.get("/{reservation_id}", response_model=ReservationOut)
async def get_reservation(
    reservation_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una reserva. Solo el guest o el host pueden verla."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reservation = await service.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reservation.guest_id != user.id and reservation.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta reserva")

    return reservation


@router.post("/{reservation_id}/respond", response_model=ReservationOut)
async def respond_to_reservation(
    reservation_id: uuid.UUID,
    data: ReservationRespondIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """El host acepta o rechaza una solicitud pendiente."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reservation = await service.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    return await service.respond_to_reservation(db, reservation, user, data)


@router.post("/{reservation_id}/cancel", response_model=ReservationOut)
async def cancel_reservation(
    reservation_id: uuid.UUID,
    data: ReservationCancelIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Cancela una reserva activa."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reservation = await service.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    return await service.cancel_reservation(db, reservation, user, data)


# ── Gestión de disponibilidad por el host ─────────────────────────────────────

@router.post("/availability/{property_id}/block", status_code=status.HTTP_200_OK)
async def block_dates(
    property_id: uuid.UUID,
    data: BlockDatesIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """El host bloquea fechas en su calendario."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    from app.modules.properties.service import get_property
    prop = await get_property(db, property_id)
    if not prop or prop.host_id != user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta propiedad")

    count = await service.host_block_dates(db, property_id, data.dates, data.reason)
    return {"blocked": count}


@router.post("/availability/{property_id}/unblock", status_code=status.HTTP_200_OK)
async def unblock_dates(
    property_id: uuid.UUID,
    data: UnblockDatesIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """El host desbloquea fechas que él mismo había cerrado."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    from app.modules.properties.service import get_property
    prop = await get_property(db, property_id)
    if not prop or prop.host_id != user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso sobre esta propiedad")

    count = await service.host_unblock_dates(db, property_id, data.dates)
    return {"unblocked": count}
