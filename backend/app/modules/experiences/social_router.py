"""Routers de favoritos y reseñas de experiencias."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.experiences import social_service
from app.modules.experiences.schemas import (
    ExperienceCardOut, ExperienceReviewCreateIn, ExperienceReviewListOut,
    ExperienceReviewOut, ExperienceReviewResponseIn,
)
from app.modules.users import service as user_service

favorites_router = APIRouter()
reviews_router = APIRouter()


# ── Favoritos ────────────────────────────────────────────────────────────────

@favorites_router.get("/ids", response_model=list[uuid.UUID])
async def favorite_ids(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return await social_service.list_favorite_ids(db, current_user.id)


@favorites_router.get("", response_model=list[ExperienceCardOut])
async def favorites(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    exps = await social_service.list_favorites(db, current_user.id)
    return [ExperienceCardOut.model_validate(e) for e in exps]


@favorites_router.put("/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(experience_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await social_service.add_favorite(db, current_user.id, experience_id)


@favorites_router.delete("/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(experience_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await social_service.remove_favorite(db, current_user.id, experience_id)


# ── Reseñas ──────────────────────────────────────────────────────────────────

@reviews_router.post("", response_model=ExperienceReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(data: ExperienceReviewCreateIn, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return await social_service.create_review(db, user, data)


@reviews_router.get("/experience/{experience_id}", response_model=ExperienceReviewListOut)
async def list_reviews(
    experience_id: uuid.UUID,
    page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    reviews, total, avg = await social_service.list_reviews(db, experience_id, page, per_page)
    return ExperienceReviewListOut(reviews=reviews, total=total, avg_rating=avg)


@reviews_router.post("/{review_id}/response", response_model=ExperienceReviewOut)
async def respond_review(review_id: uuid.UUID, data: ExperienceReviewResponseIn, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    return await social_service.add_host_response(db, review_id, user, data)
