"""Lógica de negocio para reseñas."""

import uuid
import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.modules.reviews.models import Review
from app.modules.reviews.schemas import HostResponseIn, ReviewCreateIn
from app.modules.reservations.models import Reservation
from app.modules.properties.models import Property
from app.modules.users.models import User

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_completed_reservation(
    db: AsyncSession, reservation_id: uuid.UUID, user_id: uuid.UUID
) -> Reservation:
    """Valida que la reserva esté completada y dentro de la ventana de reseña."""
    from fastapi import HTTPException

    result = await db.execute(
        select(Reservation).where(Reservation.id == reservation_id)
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reservation.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Solo puedes reseñar reservas que ya completaste",
        )

    if reservation.guest_id != user_id and reservation.host_id != user_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta reserva")

    # Ventana de tiempo
    window = timedelta(days=settings.REVIEW_WINDOW_DAYS)
    deadline = datetime.combine(reservation.check_out, datetime.min.time()).replace(
        tzinfo=timezone.utc
    ) + window
    if datetime.now(timezone.utc) > deadline:
        raise HTTPException(
            status_code=400,
            detail=f"La ventana para dejar reseña ({settings.REVIEW_WINDOW_DAYS} días) ya expiró",
        )

    return reservation


async def _update_property_metrics(
    db: AsyncSession, property_id: uuid.UUID
) -> None:
    """Recalcula las métricas agregadas de la propiedad basándose en las reseñas activas."""
    result = await db.execute(
        select(
            func.count().label("total"),
            func.avg(Review.overall_rating).label("avg_rating"),
            func.avg(Review.cleanliness_rating).label("avg_cleanliness"),
            func.avg(Review.communication_rating).label("avg_communication"),
            func.avg(Review.location_rating).label("avg_location"),
            func.avg(Review.value_rating).label("avg_value"),
        ).where(
            Review.property_id == property_id,
            Review.review_type == "guest_to_host",
            Review.is_published.is_(True),
        )
    )
    row = result.one()

    prop_result = await db.execute(select(Property).where(Property.id == property_id))
    prop = prop_result.scalar_one_or_none()
    if prop:
        prop.total_reviews = row.total or 0
        prop.avg_rating = round(Decimal(str(row.avg_rating)), 2) if row.avg_rating else None
        prop.avg_cleanliness = round(Decimal(str(row.avg_cleanliness)), 2) if row.avg_cleanliness else None
        prop.avg_communication = round(Decimal(str(row.avg_communication)), 2) if row.avg_communication else None
        prop.avg_location = round(Decimal(str(row.avg_location)), 2) if row.avg_location else None
        prop.avg_value = round(Decimal(str(row.avg_value)), 2) if row.avg_value else None
        await db.flush()


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def create_review(
    db: AsyncSession, reviewer: User, data: ReviewCreateIn
) -> Review:
    """
    Crea una reseña.
    - Guest → reseña la propiedad y al host (reviewer_type='guest').
    - Host → reseña al guest (reviewer_type='host').
    """
    from fastapi import HTTPException

    reservation = await _get_completed_reservation(db, data.reservation_id, reviewer.id)

    is_guest = reservation.guest_id == reviewer.id
    review_type = "guest_to_host" if is_guest else "host_to_guest"
    reviewed_id = reservation.host_id if is_guest else reservation.guest_id

    # Verificar que no haya reseña previa de este tipo
    existing = await db.execute(
        select(Review)
        .where(
            Review.reservation_id == data.reservation_id,
            Review.review_type == review_type,
        )
        .with_for_update()
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Ya dejaste una reseña para esta estadía",
        )

    review = Review(
        reservation_id=data.reservation_id,
        property_id=reservation.property_id,
        reviewer_id=reviewer.id,
        reviewed_id=reviewed_id,
        review_type=review_type,
        overall_rating=data.rating,
        comment=data.comment,
        cleanliness_rating=data.cleanliness if is_guest else None,
        communication_rating=data.communication if is_guest else None,
        location_rating=data.location if is_guest else None,
        value_rating=data.value if is_guest else None,
    )
    db.add(review)
    await db.flush()

    # Marcar que el usuario ya reseñó en la reserva
    now = datetime.now(timezone.utc)
    if is_guest:
        reservation.guest_reviewed_at = now
    else:
        reservation.host_reviewed_at = now

    # Actualizar métricas de la propiedad
    if is_guest and reservation.property_id:
        await _update_property_metrics(db, reservation.property_id)

    logger.info("Reseña %s creada por %s (%s)", review.id, reviewer.id, review_type)
    return review


async def add_host_response(
    db: AsyncSession, review: Review, host: User, data: HostResponseIn
) -> Review:
    """El host responde a una reseña de un guest."""
    from fastapi import HTTPException

    if review.review_type != "guest_to_host":
        raise HTTPException(status_code=400, detail="Solo puedes responder reseñas de huéspedes")
    if review.reviewed_id != host.id:
        raise HTTPException(status_code=403, detail="Esta reseña no es sobre ti")
    if review.response_text:
        raise HTTPException(status_code=409, detail="Ya respondiste esta reseña")

    review.response_text = data.response
    review.response_at = datetime.now(timezone.utc)
    await db.flush()
    return review


async def list_property_reviews(
    db: AsyncSession,
    property_id: uuid.UUID,
    page: int = 1,
    per_page: int = 10,
) -> tuple[list[Review], int, Optional[float]]:
    """Lista las reseñas públicas de una propiedad."""
    query = (
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(
            Review.property_id == property_id,
            Review.review_type == "guest_to_host",
            Review.is_published.is_(True),
        )
        .order_by(Review.created_at.desc())
    )
    count_q = select(func.count()).where(
        Review.property_id == property_id,
        Review.review_type == "guest_to_host",
        Review.is_published.is_(True),
    )
    avg_q = select(func.avg(Review.overall_rating)).where(
        Review.property_id == property_id,
        Review.review_type == "guest_to_host",
        Review.is_published.is_(True),
    )

    total = (await db.execute(count_q)).scalar() or 0
    avg_rating = (await db.execute(avg_q)).scalar()
    result = await db.execute(query.offset((page - 1) * per_page).limit(per_page))
    reviews = list(result.scalars().all())

    return reviews, total, float(avg_rating) if avg_rating else None


async def get_review(db: AsyncSession, review_id: uuid.UUID) -> Optional[Review]:
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.id == review_id)
    )
    return result.scalar_one_or_none()
