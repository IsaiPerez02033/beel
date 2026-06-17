"""Pydantic schemas para reseñas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ReviewerOut(BaseModel):
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: uuid.UUID
    reservation_id: uuid.UUID
    property_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewed_id: uuid.UUID
    review_type: str
    overall_rating: int
    cleanliness_rating: Optional[int]
    communication_rating: Optional[int]
    location_rating: Optional[int]
    value_rating: Optional[int]
    comment: Optional[str]
    response_text: Optional[str]
    response_at: Optional[datetime]
    is_published: bool
    reviewer: Optional[ReviewerOut] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ReviewListOut(BaseModel):
    reviews: list[ReviewOut]
    total: int
    avg_rating: Optional[float]


class ReviewCreateIn(BaseModel):
    reservation_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)
    # Calificaciones granulares (solo para guest → propiedad)
    cleanliness: Optional[int] = Field(None, ge=1, le=5)
    communication: Optional[int] = Field(None, ge=1, le=5)
    location: Optional[int] = Field(None, ge=1, le=5)
    value: Optional[int] = Field(None, ge=1, le=5)


class HostResponseIn(BaseModel):
    response: str = Field(..., min_length=1, max_length=1000)
