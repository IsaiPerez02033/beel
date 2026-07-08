"""Pydantic schemas para el módulo de experiencias."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

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


# ── Reservas de experiencia (bookings) ──────────────────────────────────────────

class ExperienceSnapshotOut(BaseModel):
    """Resumen de la experiencia embebido en una reserva."""
    id: uuid.UUID
    title: str
    city: str
    neighborhood: Optional[str] = None
    category: str
    duration_minutes: int
    photos: list[dict] = []

    model_config = {"from_attributes": True}

    @field_validator("photos", mode="before")
    @classmethod
    def _photos_to_dicts(cls, v):
        if not v:
            return []
        out = []
        for p in v:
            if isinstance(p, dict):
                out.append(p)
            else:
                out.append({
                    "url": getattr(p, "url", ""),
                    "is_primary": bool(getattr(p, "is_primary", False)),
                })
        return out


class ExperiencePriceBreakdownOut(BaseModel):
    participants: int
    price_per_person: Decimal
    subtotal: Decimal
    platform_fee: Decimal
    lodging_iva: Decimal = Decimal("0")
    total: Decimal
    currency: str


class ExperienceBookingOut(BaseModel):
    id: uuid.UUID
    experience_id: uuid.UUID
    guest_id: uuid.UUID
    host_id: uuid.UUID

    booking_date: date
    start_time: Optional[time]
    participants: int

    price_per_person_snapshot: Decimal
    subtotal: Decimal
    platform_fee_snapshot: Decimal
    total_amount: Decimal
    currency: str

    lodging_iva_snapshot: Decimal = Decimal("0")
    host_has_rfc: bool = False
    isr_retention_pct: Decimal = Decimal("0")
    iva_retention_pct: Decimal = Decimal("0")
    isr_retention_snapshot: Decimal = Decimal("0")
    iva_retention_snapshot: Decimal = Decimal("0")
    host_net_payout: Decimal = Decimal("0")

    cancellation_policy_snapshot: str
    status: str
    payment_status: str
    guest_reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str]
    cancellation_reason: Optional[str]
    host_message: Optional[str]
    guest_message: Optional[str]
    host_response_deadline: Optional[datetime]

    experience: Optional[ExperienceSnapshotOut] = None
    guest: Optional[dict] = None
    host: Optional[dict] = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("guest", "host", mode="before")
    @classmethod
    def _user_to_dict(cls, v):
        if v is None or isinstance(v, dict):
            return v
        return {
            "id": str(getattr(v, "id", "")),
            "full_name": getattr(v, "full_name", ""),
            "avatar_url": getattr(v, "avatar_url", None),
            "is_identity_verified": bool(getattr(v, "is_identity_verified", False)),
        }


class ExperienceBookingListOut(BaseModel):
    bookings: list[ExperienceBookingOut]
    total: int
    page: int
    per_page: int


class ExperienceBookingCreateIn(BaseModel):
    experience_id: uuid.UUID
    booking_date: date
    start_time: Optional[time] = None
    participants: int = Field(..., ge=1, le=100)
    guest_message: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def _validate_date(self) -> "ExperienceBookingCreateIn":
        from datetime import date as date_type, timedelta
        if self.booking_date < date_type.today() - timedelta(days=1):
            raise ValueError("La fecha no puede ser en el pasado")
        return self


class ExperienceBookingRespondIn(BaseModel):
    action: str = Field(..., pattern="^(confirm|reject)$")
    message: Optional[str] = Field(None, max_length=500)
    rejection_reason: Optional[str] = Field(None, max_length=500)


class ExperienceBookingCancelIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


# ── Reseñas de experiencia ──────────────────────────────────────────────────────

class ExperienceReviewCreateIn(BaseModel):
    booking_id: uuid.UUID
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=2000)


class ExperienceReviewResponseIn(BaseModel):
    response: str = Field(..., min_length=1, max_length=1000)


class ExperienceReviewOut(BaseModel):
    id: uuid.UUID
    experience_id: uuid.UUID
    reviewer_id: uuid.UUID
    rating: int
    comment: Optional[str]
    response_text: Optional[str]
    response_at: Optional[datetime]
    reviewer: Optional[dict] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("reviewer", mode="before")
    @classmethod
    def _reviewer_to_dict(cls, v):
        if v is None or isinstance(v, dict):
            return v
        return {
            "id": str(getattr(v, "id", "")),
            "full_name": getattr(v, "full_name", ""),
            "avatar_url": getattr(v, "avatar_url", None),
        }


class ExperienceReviewListOut(BaseModel):
    reviews: list[ExperienceReviewOut]
    total: int
    avg_rating: Optional[float] = None
