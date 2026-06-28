"""Pydantic schemas para el módulo de reservaciones."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator, field_validator


# ── Subschemas ────────────────────────────────────────────────────────────────

class PropertySnapshotOut(BaseModel):
    id: uuid.UUID
    title: str
    city: str
    neighborhood: Optional[str]
    photos: list[dict] = []  # [{url, is_primary}]
    # Solo se incluye si el solicitante es el huésped con reserva confirmada
    address: Optional[str] = None
    state: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = {"from_attributes": True}

    @field_validator("photos", mode="before")
    @classmethod
    def _photos_to_dicts(cls, v):
        """Convierte objetos PropertyPhoto ORM a dicts (el campo es list[dict])."""
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


class UserSnapshotOut(BaseModel):
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


# ── Respuestas ────────────────────────────────────────────────────────────────

class ReservationOut(BaseModel):
    id: uuid.UUID
    property_id: uuid.UUID
    guest_id: uuid.UUID
    host_id: uuid.UUID

    check_in: date
    check_out: date
    guests_count: int
    nights: int

    price_per_night_snapshot: Decimal
    cleaning_fee_snapshot: Decimal
    security_deposit_snapshot: Decimal
    platform_fee_snapshot: Decimal
    total_amount: Decimal
    currency: str

    cancellation_policy_snapshot: str
    status: str
    rejection_reason: Optional[str]
    cancellation_reason: Optional[str]
    host_message: Optional[str]
    guest_message: Optional[str]
    host_response_deadline: Optional[datetime]

    reservation_property: Optional[PropertySnapshotOut] = None
    guest: Optional[dict] = None
    host: Optional[dict] = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("guest", "host", mode="before")
    @classmethod
    def _user_to_dict(cls, v):
        """Convierte el objeto User ORM a dict (el campo es dict). Sin esto,
        Pydantic intenta validar un User contra `dict` → ResponseValidationError."""
        if v is None or isinstance(v, dict):
            return v
        return {
            "id": str(getattr(v, "id", "")),
            "full_name": getattr(v, "full_name", ""),
            "avatar_url": getattr(v, "avatar_url", None),
            "is_identity_verified": bool(getattr(v, "is_identity_verified", False)),
        }


class ReservationListOut(BaseModel):
    reservations: list[ReservationOut]
    total: int
    page: int
    per_page: int


# ── Desglose de precios (para el widget de reserva) ──────────────────────────

class PriceBreakdownOut(BaseModel):
    nights: int
    price_per_night: Decimal
    subtotal: Decimal
    cleaning_fee: Decimal
    security_deposit: Decimal
    platform_fee: Decimal
    total: Decimal
    currency: str


# ── Mutaciones ────────────────────────────────────────────────────────────────

class ReservationCreateIn(BaseModel):
    property_id: uuid.UUID
    check_in: date
    check_out: date
    guests_count: int = Field(..., ge=1, le=30)
    guest_message: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_dates(self) -> "ReservationCreateIn":
        from datetime import date as date_type, timedelta
        # El servidor corre en UTC y puede ir 1 día adelantado respecto al
        # huésped (ej. noche en México = madrugada del día siguiente en UTC).
        # Damos 1 día de tolerancia para no rechazar reservas de "hoy".
        earliest = date_type.today() - timedelta(days=1)
        if self.check_in < earliest:
            raise ValueError("La fecha de llegada no puede ser en el pasado")
        if self.check_out <= self.check_in:
            raise ValueError("La fecha de salida debe ser posterior a la de llegada")
        return self


class ReservationRespondIn(BaseModel):
    """Host acepta o rechaza una solicitud."""
    action: str = Field(..., pattern="^(confirm|reject)$")
    message: Optional[str] = Field(None, max_length=500)
    rejection_reason: Optional[str] = Field(None, max_length=500)


class ReservationCancelIn(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


# ── Disponibilidad ────────────────────────────────────────────────────────────

class AvailabilityOut(BaseModel):
    date: date
    is_available: bool
    price_override: Optional[Decimal]
    blocked_reason: Optional[str]

    model_config = {"from_attributes": True}


class AvailabilityRangeOut(BaseModel):
    property_id: uuid.UUID
    days: list[AvailabilityOut]


class BlockDatesIn(BaseModel):
    dates: list[date] = Field(..., min_length=1, max_length=365)
    reason: str = Field(default="host_block", pattern="^(host_block|maintenance)$")


class UnblockDatesIn(BaseModel):
    dates: list[date] = Field(..., min_length=1, max_length=365)
