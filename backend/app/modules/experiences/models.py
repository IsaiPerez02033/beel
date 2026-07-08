"""Modelos de Experiencias (actividades/tours estilo Airbnb Experiences)."""

import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Numeric, SmallInteger, String, Text, Time, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.payments.models import Payment


class Experience(Base, TimestampMixin):
    __tablename__ = "experiences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )

    # Información básica
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending_review", index=True
    )

    # Ubicación (punto de encuentro)
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

    # Detalles de la actividad
    price_per_person: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    duration_minutes: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=60)
    min_participants: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    max_participants: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=10)
    languages: Mapped[Optional[str]] = mapped_column(String(255))   # p.ej. "Español, Inglés"
    included: Mapped[Optional[str]] = mapped_column(Text)           # qué incluye
    requirements: Mapped[Optional[str]] = mapped_column(Text)       # requisitos

    # Políticas
    instant_booking: Mapped[bool] = mapped_column(Boolean, default=False)
    cancellation_policy: Mapped[str] = mapped_column(String(20), default="flexible")

    # Métricas cacheadas
    total_reviews: Mapped[int] = mapped_column(default=0)
    avg_rating: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
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
    host: Mapped["User"] = relationship("User", foreign_keys=[host_id], lazy="selectin")
    photos: Mapped[list["ExperiencePhoto"]] = relationship(
        "ExperiencePhoto",
        back_populates="experience",
        order_by="ExperiencePhoto.display_order",
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint("price_per_person > 0", name="chk_exp_price_positive"),
        CheckConstraint("max_participants > 0", name="chk_exp_max_participants"),
        CheckConstraint(
            "category IN ('gastronomia','aventura','cultura','arte','naturaleza',"
            "'deporte','bienestar','vida_nocturna','tour','otro')",
            name="chk_exp_category",
        ),
        CheckConstraint(
            "status IN ('pending_review','active','inactive','suspended','deleted')",
            name="chk_exp_status",
        ),
    )

    @property
    def primary_photo(self) -> Optional["ExperiencePhoto"]:
        primary = next((p for p in self.photos if p.is_primary), None)
        return primary or (self.photos[0] if self.photos else None)

    @property
    def is_active(self) -> bool:
        return self.status == "active" and self.deleted_at is None

    def __repr__(self) -> str:
        return f"<Experience id={self.id} title={self.title!r} status={self.status}>"


class ExperiencePhoto(Base):
    __tablename__ = "experience_photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("experiences.id", ondelete="CASCADE"),
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

    experience: Mapped["Experience"] = relationship("Experience", back_populates="photos")


class ExperienceBooking(Base, TimestampMixin):
    """
    Reserva de una experiencia (por sesión: fecha + hora + nº de participantes).

    Espejo de `Reservation` pero adaptado a actividades: precio por persona,
    sin rango de noches ni bloqueo de calendario. El anfitrión confirma la
    solicitud (o instant_booking la confirma directo).

    Estados:
      pending    → huésped solicitó, anfitrión no ha respondido
      confirmed  → anfitrión aceptó (o instant_booking)
      rejected   → anfitrión rechazó
      cancelled_guest / cancelled_host → cancelada
      completed  → la experiencia se realizó
    """
    __tablename__ = "experience_bookings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    experience_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("experiences.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )

    # Sesión
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[Optional[time]] = mapped_column(Time)
    participants: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)

    # Snapshot de precios al momento de la reserva
    price_per_person_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    platform_fee_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    platform_fee_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")

    # IVA del servicio sumado al huésped (modelo Airbnb)
    lodging_iva_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))

    # Snapshot de retención de impuestos al anfitrión (ISR e IVA)
    host_has_rfc: Mapped[bool] = mapped_column(Boolean, default=False)
    isr_retention_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    iva_retention_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    isr_retention_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    iva_retention_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    host_net_payout: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))

    cancellation_policy_snapshot: Mapped[str] = mapped_column(String(20), default="flexible")

    # Estado y flujo
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    host_message: Mapped[Optional[str]] = mapped_column(Text)
    guest_message: Mapped[Optional[str]] = mapped_column(Text)

    host_response_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payout_scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payout_released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")

    guest_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    host_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)

    # Relaciones
    experience: Mapped["Experience"] = relationship("Experience", foreign_keys=[experience_id], lazy="selectin")
    guest: Mapped["User"] = relationship("User", foreign_keys=[guest_id], lazy="selectin")
    host: Mapped["User"] = relationship("User", foreign_keys=[host_id], lazy="selectin")
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="experience_booking", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint("participants > 0", name="chk_exp_booking_participants"),
        CheckConstraint("total_amount > 0", name="chk_exp_booking_total"),
        CheckConstraint(
            "status IN ('pending','confirmed','rejected','cancelled_guest',"
            "'cancelled_host','completed')",
            name="chk_exp_booking_status",
        ),
    )

    @property
    def is_active(self) -> bool:
        return self.status in ("pending", "confirmed")

    def __repr__(self) -> str:
        return f"<ExperienceBooking id={self.id} status={self.status} date={self.booking_date}>"
