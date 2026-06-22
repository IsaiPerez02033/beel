"""Router de reseñas."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.reviews import service
from app.modules.reviews.schemas import (
    HostResponseIn,
    ReviewCreateIn,
    ReviewListOut,
    ReviewOut,
)
from app.modules.users import service as user_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/property/{property_id}", response_model=ReviewListOut)
async def list_property_reviews(
    property_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Lista las reseñas públicas de una propiedad."""
    reviews, total, avg = await service.list_property_reviews(db, property_id, page, per_page)
    return ReviewListOut(reviews=reviews, total=total, avg_rating=avg)


@router.post("", response_model=ReviewOut, status_code=201)
async def create_review(
    data: ReviewCreateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Crea una reseña post-estancia (guest o host)."""
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return await service.create_review(db, user, data)


@router.post("/{review_id}/respond", response_model=ReviewOut)
async def respond_to_review(
    review_id: uuid.UUID,
    data: HostResponseIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """El host responde públicamente a una reseña de un guest."""
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    review = await service.get_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Reseña no encontrada")
    return await service.add_host_response(db, review, user, data)
