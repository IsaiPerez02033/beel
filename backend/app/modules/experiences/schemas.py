"""Pydantic schemas para el módulo de experiencias."""

import uuid
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.modules.properties.schemas import HostOut


class ExperiencePhotoOut(BaseModel):
    id: uuid.UUID
    url: str
    thumbnail_url: Optional[str]
    display_order: int
    is_primary: bool
    caption: Optional[str]
    s3_key: Optional[str] = None

    model_config = {"from_attributes": True}


class ExperienceCardOut(BaseModel):
    """Schema reducido para grids/tarjetas."""
    id: uuid.UUID
    title: str
    status: str
    category: str
    neighborhood: Optional[str]
    city: str
    price_per_person: Decimal
    currency: str
    duration_minutes: int
    max_participants: int
    instant_booking: bool
    total_reviews: int
    avg_rating: Optional[Decimal]
    host: HostOut
    photos: list[ExperiencePhotoOut]

    model_config = {"from_attributes": True}


class ExperienceOut(BaseModel):
    """Detalle completo de una experiencia."""
    id: uuid.UUID
    host_id: uuid.UUID
    title: str
    description: str
    category: str
    status: str
    address: str
    neighborhood: Optional[str]
    city: str
    state: str
    country: str
    postal_code: Optional[str]
    latitude_approx: Optional[Decimal]
    longitude_approx: Optional[Decimal]
    price_per_person: Decimal
    currency: str
    duration_minutes: int
    min_participants: int
    max_participants: int
    languages: Optional[str]
    included: Optional[str]
    requirements: Optional[str]
    instant_booking: bool
    cancellation_policy: str
    total_reviews: int
    avg_rating: Optional[Decimal]
    total_bookings: int
    host: HostOut
    photos: list[ExperiencePhotoOut]

    model_config = {"from_attributes": True}


class ExperienceCreateIn(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    category: str = Field(..., pattern="^(gastronomia|aventura|cultura|arte|naturaleza|deporte|bienestar|vida_nocturna|tour|otro)$")
    address: str = Field(..., min_length=3, max_length=500)
    neighborhood: Optional[str] = Field(None, max_length=255)
    city: str = Field(..., min_length=1, max_length=100)
    state: str = Field(..., min_length=1, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    latitude: Decimal
    longitude: Decimal
    price_per_person: Decimal = Field(..., gt=0)
    duration_minutes: int = Field(60, ge=15, le=1440)
    min_participants: int = Field(1, ge=1, le=100)
    max_participants: int = Field(10, ge=1, le=100)
    languages: Optional[str] = Field(None, max_length=255)
    included: Optional[str] = None
    requirements: Optional[str] = None
    instant_booking: bool = False
    cancellation_policy: str = Field("flexible", pattern="^(flexible|moderada|estricta)$")


class ExperienceUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20)
    category: Optional[str] = Field(None, pattern="^(gastronomia|aventura|cultura|arte|naturaleza|deporte|bienestar|vida_nocturna|tour|otro)$")
    price_per_person: Optional[Decimal] = Field(None, gt=0)
    duration_minutes: Optional[int] = Field(None, ge=15, le=1440)
    min_participants: Optional[int] = Field(None, ge=1, le=100)
    max_participants: Optional[int] = Field(None, ge=1, le=100)
    languages: Optional[str] = Field(None, max_length=255)
    included: Optional[str] = None
    requirements: Optional[str] = None
    instant_booking: Optional[bool] = None
    cancellation_policy: Optional[str] = Field(None, pattern="^(flexible|moderada|estricta)$")
    status: Optional[str] = Field(None, pattern="^(active|inactive)$")


class ExperienceListOut(BaseModel):
    experiences: list[ExperienceCardOut]
    total: int
    page: int
    per_page: int
    total_pages: int
