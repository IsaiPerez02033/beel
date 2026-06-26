"""
Modelos SQLAlchemy para el módulo de propiedades.

Patrón de referencia para todos los modelos de Beel:
  - Usar Mapped[] con type hints explícitos (SQLAlchemy 2.0)
  - mapped_column() en lugar de Column()
  - Campos opcionales con Optional[tipo]
  - Relaciones con lazy="selectin" para evitar N+1 queries
"""

import uuid
from datetime import datetime, time
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey,
    Index, Numeric, SmallInteger, String, Text,
    Time, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.reservations.models import Reservation
    from app.modules.reviews.models import Review


class Property(Base, TimestampMixin):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Información básica
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    property_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending_review",
        index=True,
    )

    # Ubicación
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    neighborhood: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False, default="México")
    country_code: Mapped[str] = mapped_column(String(3), default="MX")
    postal_code: Mapped[Optional[str]] = mapped_column(String(20))
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(11, 8), nullable=False)
    latitude_approx: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 5))
    longitude_approx: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 5))

    # Capacidad
    max_guests: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    bedrooms: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    beds: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    bathrooms: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False, default=Decimal("1.0"))

    # Precios
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    security_deposit: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    min_stay_nights: Mapped[int] = mapped_column(SmallInteger, default=1)
    max_stay_nights: Mapped[Optional[int]] = mapped_column(SmallInteger, default=30)

    # Políticas
    cancellation_policy: Mapped[str] = mapped_column(String(20), default="flexible")
    check_in_time: Mapped[Optional[time]] = mapped_column(Time)
    check_out_time: Mapped[Optional[time]] = mapped_column(Time)
    instant_booking: Mapped[bool] = mapped_column(Boolean, default=False)
    allows_pets: Mapped[bool] = mapped_column(Boolean, default=False)
    allows_smoking: Mapped[bool] = mapped_column(Boolean, default=False)
    allows_events: Mapped[bool] = mapped_column(Boolean, default=False)

    # Métricas cacheadas
    total_reviews: Mapped[int] = mapped_column(default=0)
    avg_rating: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    avg_cleanliness: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    avg_communication: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    avg_location: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    avg_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    total_bookings: Mapped[int] = mapped_column(default=0)
    ranking_score: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=Decimal("0"))

    # Soft delete y auditoría
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Relaciones
    host: Mapped["User"] = relationship(
        "User",
        foreign_keys=[host_id],
        lazy="selectin",
    )
    photos: Mapped[list["PropertyPhoto"]] = relationship(
        "PropertyPhoto",
        back_populates="listing",
        order_by="PropertyPhoto.display_order",
        lazy="selectin",
    )
    amenities: Mapped[list["PropertyAmenity"]] = relationship(
        "PropertyAmenity",
        back_populates="property",
        lazy="selectin",
    )
    reservations: Mapped[list["Reservation"]] = relationship(
        "Reservation",
        back_populates="reservation_property",
        lazy="noload",      # no cargar por defecto — puede ser enorme
    )

    __table_args__ = (
        CheckConstraint("max_guests > 0", name="chk_max_guests"),
        CheckConstraint("price_per_night > 0", name="chk_price_positive"),
        CheckConstraint(
            "property_type IN ('casa','departamento','cabaña','villa','habitacion','hostal','otro')",
            name="chk_property_type"
        ),
        CheckConstraint(
            "status IN ('pending_review','active','inactive','suspended','deleted')",
            name="chk_property_status"
        ),
    )

    @property
    def primary_photo(self) -> Optional["PropertyPhoto"]:
        """Retorna la foto principal o la primera disponible."""
        primary = next((p for p in self.photos if p.is_primary), None)
        return primary or (self.photos[0] if self.photos else None)

    @property
    def is_active(self) -> bool:
        return self.status == "active" and self.deleted_at is None

    def __repr__(self) -> str:
        return f"<Property id={self.id} title={self.title!r} status={self.status}>"


class PropertyPhoto(Base):
    __tablename__ = "property_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    url: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    caption: Mapped[Optional[str]] = mapped_column(String(255))
    s3_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    listing: Mapped["Property"] = relationship("Property", back_populates="photos")


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name_es: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[Optional[str]] = mapped_column(String(100))
    name_pt: Mapped[Optional[str]] = mapped_column(String(100))
    icon: Mapped[Optional[str]] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_highlight: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    properties: Mapped[list["PropertyAmenity"]] = relationship(
        "PropertyAmenity", back_populates="amenity"
    )


class PropertyAmenity(Base):
    __tablename__ = "property_amenities"

    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    amenity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("amenities.id", ondelete="CASCADE"),
        primary_key=True,
    )

    property: Mapped["Property"] = relationship("Property", back_populates="amenities")
    amenity: Mapped["Amenity"] = relationship("Amenity", back_populates="properties")
