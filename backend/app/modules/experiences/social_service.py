"""Favoritos y reseñas de experiencias."""

import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.experiences.models import (
    Experience, ExperienceBooking, ExperienceFavorite, ExperienceReview,
)
from app.modules.experiences.schemas import (
    ExperienceReviewCreateIn, ExperienceReviewResponseIn,
)
from app.modules.users.models import User

logger = logging.getLogger(__name__)


# ── Favoritos ────────────────────────────────────────────────────────────────

async def add_favorite(db: AsyncSession, user_id: uuid.UUID, experience_id: uuid.UUID) -> None:
    existing = await db.execute(
        select(ExperienceFavorite).where(
            ExperienceFavorite.user_id == user_id,
            ExperienceFavorite.experience_id == experience_id,
        )
    )
    if existing.scalar_one_or_none():
        return
    db.add(ExperienceFavorite(user_id=user_id, experience_id=experience_id))
    await db.flush()


async def remove_favorite(db: AsyncSession, user_id: uuid.UUID, experience_id: uuid.UUID) -> None:
    await db.execute(
        delete(ExperienceFavorite).where(
            ExperienceFavorite.user_id == user_id,
            ExperienceFavorite.experience_id == experience_id,
        )
    )
    await db.flush()


async def list_favorite_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(ExperienceFavorite.experience_id).where(ExperienceFavorite.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def list_favorites(db: AsyncSession, user_id: uuid.UUID) -> list[Experience]:
    result = await db.execute(
        select(Experience)
        .join(ExperienceFavorite, ExperienceFavorite.experience_id == Experience.id)
        .options(selectinload(Experience.host), selectinload(Experience.photos))
        .where(ExperienceFavorite.user_id == user_id, Experience.deleted_at.is_(None))
        .order_by(ExperienceFavorite.created_at.desc())
    )
    return list(result.scalars().all())


# ── Reseñas ──────────────────────────────────────────────────────────────────

async def _update_experience_metrics(db: AsyncSession, experience_id: uuid.UUID) -> None:
    row = (await db.execute(
        select(
            func.count().label("total"),
            func.avg(ExperienceReview.rating).label("avg_rating"),
        ).where(ExperienceReview.experience_id == experience_id)
    )).one()
    exp = (await db.execute(
        select(Experience).where(Experience.id == experience_id)
    )).scalar_one_or_none()
    if exp:
        exp.total_reviews = row.total or 0
        exp.avg_rating = round(Decimal(str(row.avg_rating)), 2) if row.avg_rating else None
        await db.flush()


async def create_review(
    db: AsyncSession, reviewer: User, data: ExperienceReviewCreateIn
) -> ExperienceReview:
    booking = (await db.execute(
        select(ExperienceBooking).where(ExperienceBooking.id == data.booking_id).with_for_update()
    )).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if booking.guest_id != reviewer.id:
        raise HTTPException(status_code=403, detail="Solo el huésped puede reseñar")
    if booking.status not in ("confirmed", "completed"):
        raise HTTPException(status_code=400, detail="Solo puedes reseñar reservas confirmadas")
    if booking.booking_date >= date.today():
        raise HTTPException(status_code=400, detail="Podrás reseñar después de vivir la experiencia")

    existing = (await db.execute(
        select(ExperienceReview).where(ExperienceReview.booking_id == booking.id).with_for_update()
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Ya dejaste una reseña para esta experiencia")

    review = ExperienceReview(
        experience_id=booking.experience_id,
        booking_id=booking.id,
        reviewer_id=reviewer.id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.flush()

    booking.guest_reviewed_at = datetime.now(timezone.utc)
    if booking.status == "confirmed":
        booking.status = "completed"
    await _update_experience_metrics(db, booking.experience_id)

    logger.info("Reseña de experiencia %s creada por %s", review.id, reviewer.id)
    # Recargar con reviewer eager para serializar sin lazy-load
    return (await db.execute(
        select(ExperienceReview).options(selectinload(ExperienceReview.reviewer))
        .where(ExperienceReview.id == review.id)
    )).scalar_one()


async def add_host_response(
    db: AsyncSession, review_id: uuid.UUID, host: User, data: ExperienceReviewResponseIn
) -> ExperienceReview:
    review = (await db.execute(
        select(ExperienceReview).options(selectinload(ExperienceReview.reviewer))
        .where(ExperienceReview.id == review_id)
    )).scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    exp = (await db.execute(
        select(Experience).where(Experience.id == review.experience_id)
    )).scalar_one_or_none()
    if not exp or exp.host_id != host.id:
        raise HTTPException(status_code=403, detail="Esta reseña no es de tu experiencia")
    if review.response_text:
        raise HTTPException(status_code=409, detail="Ya respondiste esta reseña")
    review.response_text = data.response
    review.response_at = datetime.now(timezone.utc)
    await db.flush()
    return review


async def list_reviews(
    db: AsyncSession, experience_id: uuid.UUID, page: int = 1, per_page: int = 10,
):
    base = select(ExperienceReview).where(ExperienceReview.experience_id == experience_id)
    total = (await db.execute(
        select(func.count()).where(ExperienceReview.experience_id == experience_id)
    )).scalar() or 0
    avg = (await db.execute(
        select(func.avg(ExperienceReview.rating)).where(ExperienceReview.experience_id == experience_id)
    )).scalar()
    result = await db.execute(
        base.options(selectinload(ExperienceReview.reviewer))
        .order_by(ExperienceReview.created_at.desc())
        .offset((page - 1) * per_page).limit(per_page)
    )
    return list(result.scalars().all()), total, (float(avg) if avg else None)
