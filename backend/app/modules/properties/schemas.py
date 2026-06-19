"""Pydantic schemas para el módulo de propiedades."""

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Amenidad ──────────────────────────────────────────────────────────────────

class AmenityOut(BaseModel):
    id: uuid.UUID
    slug: str
    name_es: str
    icon: Optional[str]
    category: str
    is_highlight: bool

    model_config = {"from_attributes": True}


class PropertyAmenityOut(BaseModel):
    amenity: AmenityOut

    model_config = {"from_attributes": True}


# ── Foto ──────────────────────────────────────────────────────────────────────

class PropertyPhotoOut(BaseModel):
    id: uuid.UUID
    url: str
    thumbnail_url: Optional[str]
    display_order: int
    is_primary: bool
    caption: Optional[str]
    s3_key: Optional[str] = None

    model_config = {"from_attributes": True}


class PhotoUpdateIn(BaseModel):
    """Para actualizar orden, estado primario o caption de una foto."""
    display_order: Optional[int] = None
    is_primary: Optional[bool] = None
    caption: Optional[str] = None


# ── Host (resumen para incluir en propiedad) ──────────────────────────────────

class HostOut(BaseModel):
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]
    is_identity_verified: bool
    host_since: Optional[datetime]
    total_listings: int

    model_config = {"from_attributes": True}


# ── Propiedad ─────────────────────────────────────────────────────────────────

class PropertyOut(BaseModel):
    """Schema completo — para la página de detalle."""
    id: uuid.UUID
    title: str
    description: str
    property_type: str
    status: str

    # Ubicación (coordenadas exactas solo con reserva confirmada)
    address: str
    neighborhood: Optional[str]
    city: str
    state: str
    country: str
    latitude_approx: Optional[Decimal]
    longitude_approx: Optional[Decimal]

    # Capacidad
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: Decimal

    # Precios
    price_per_night: Decimal
    currency: str
    cleaning_fee: Decimal
    security_deposit: Decimal
    min_stay_nights: int
    max_stay_nights: Optional[int]

    # Políticas
    cancellation_policy: str
    check_in_time: Optional[time]
    check_out_time: Optional[time]
    instant_booking: bool
    allows_pets: bool
    allows_smoking: bool
    allows_events: bool

    # Métricas
    total_reviews: int
    avg_rating: Optional[Decimal]
    avg_cleanliness: Optional[Decimal]
    avg_communication: Optional[Decimal]
    avg_location: Optional[Decimal]
    avg_value: Optional[Decimal]
    total_bookings: int

    # Relaciones
    host: HostOut
    photos: list[PropertyPhotoOut]
    amenities: list[PropertyAmenityOut]

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PropertyCardOut(BaseModel):
    """Schema reducido para grids y tarjetas — omite datos pesados."""
    id: uuid.UUID
    title: str
    property_type: str
    neighborhood: Optional[str]
    city: str
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: Decimal
    price_per_night: Decimal
    currency: str
    cleaning_fee: Decimal
    instant_booking: bool
    allows_pets: bool
    total_reviews: int
    avg_rating: Optional[Decimal]
    host: HostOut
    photos: list[PropertyPhotoOut]
    cancellation_policy: str
    min_stay_nights: int

    model_config = {"from_attributes": True}


class SearchResultOut(BaseModel):
    """Respuesta paginada de búsqueda."""
    properties: list[PropertyCardOut]
    total: int
    page: int
    per_page: int
    total_pages: int


# ── Crear / Actualizar propiedad ──────────────────────────────────────────────

class PropertyCreateIn(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., min_length=20)
    property_type: str = Field(..., pattern="^(casa|departamento|cabaña|villa|habitacion|hostal|otro)$")

    address: str = Field(..., min_length=5, max_length=500)
    neighborhood: Optional[str] = Field(None, max_length=255)
    city: str = "Mérida"
    state: str = "Yucatán"
    country: str = "México"
    postal_code: Optional[str] = None
    latitude: Decimal = Field(..., ge=-90, le=90)
    longitude: Decimal = Field(..., ge=-180, le=180)

    max_guests: int = Field(..., ge=1, le=30)
    bedrooms: int = Field(..., ge=0, le=20)
    beds: int = Field(..., ge=1, le=30)
    bathrooms: Decimal = Field(..., ge=0.5, le=20)

    price_per_night: Decimal = Field(..., gt=0)
    cleaning_fee: Decimal = Field(default=Decimal("0"), ge=0)
    security_deposit: Decimal = Field(default=Decimal("0"), ge=0)
    min_stay_nights: int = Field(default=1, ge=1, le=365)
    max_stay_nights: Optional[int] = Field(default=30, ge=1, le=365)

    cancellation_policy: str = Field(
        default="flexible",
        pattern="^(flexible|moderada|estricta)$",
    )
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    instant_booking: bool = False
    allows_pets: bool = False
    allows_smoking: bool = False
    allows_events: bool = False

    amenity_ids: list[uuid.UUID] = Field(default_factory=list)


class PropertyUpdateIn(BaseModel):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    description: Optional[str] = Field(None, min_length=20)
    price_per_night: Optional[Decimal] = Field(None, gt=0)
    cleaning_fee: Optional[Decimal] = Field(None, ge=0)
    security_deposit: Optional[Decimal] = Field(None, ge=0)
    min_stay_nights: Optional[int] = Field(None, ge=1)
    max_stay_nights: Optional[int] = Field(None, ge=1)
    cancellation_policy: Optional[str] = Field(
        None, pattern="^(flexible|moderada|estricta)$"
    )
    check_in_time: Optional[time] = None
    check_out_time: Optional[time] = None
    instant_booking: Optional[bool] = None
    allows_pets: Optional[bool] = None
    allows_smoking: Optional[bool] = None
    allows_events: Optional[bool] = None
    status: Optional[str] = Field(
        None, pattern="^(active|inactive)$"
    )
