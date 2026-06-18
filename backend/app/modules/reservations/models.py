"""
Modelos SQLAlchemy para reservaciones y disponibilidad.

Diseño clave:
  - Snapshots de precio/política al momento de la reserva (no referencias en vivo).
    Esto garantiza que una reserva existente no se vea afectada si el host cambia
    el precio o la política después.
  - Estado de la reserva como máquina de estados explícita.
  - La tabla availability bloquea fechas atómicamente para evitar doble-booking.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, ForeignKey,
    Integer, Numeric, SmallInteger, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.properties.models import Property
    from app.modules.users.models import User
    from app.modules.payments.models import Payment


class Availability(Base, TimestampMixin):
    """
    Calendario de disponibilidad por propiedad/fecha.
    Una fila por día. is_available=False puede significar:
      - blocked_reason='reservation'  → reserva existente
      - blocked_reason='host_block'   → el host cerró esa fecha
      - blocked_reason='maintenance'  → mantenimiento
    """
    __tablename__ = "availability"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, server_default="TRUE")
    price_override: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    blocked_reason: Mapped[Optional[str]] = mapped_column(String(50))
    reservation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))

    __table_args__ = (
        # Garantía de unicidad: 1 fila por propiedad/fecha
        __import__("sqlalchemy").UniqueConstraint(
            "property_id", "date", name="uq_availability_property_date"
        ),
    )


class Reservation(Base, TimestampMixin):
    """
    Reserva de una propiedad.

    Estados:
      pending    → huésped solicitó, host no ha respondido
      confirmed  → host aceptó (instant_booking también llega aquí directo)
      rejected   → host rechazó
      cancelled_guest → huésped canceló
      cancelled_host  → host canceló
      completed  → check-out completado
    """
    __tablename__ = "reservations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Fechas
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    nights: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # GENERATED ALWAYS — no escribir
    guests_count: Mapped[int] = mapped_column("guests_count", SmallInteger, nullable=False)

    # Snapshot de precios al momento de la reserva
    price_per_night_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cleaning_fee_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    security_deposit_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    platform_fee_snapshot: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    platform_fee_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")

    # Snapshot de política de cancelación
    cancellation_policy_snapshot: Mapped[str] = mapped_column(String(20), nullable=False)

    # Estado y flujo
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending", index=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    host_message: Mapped[Optional[str]] = mapped_column(Text)
    guest_message: Mapped[Optional[str]] = mapped_column(Text)

    # Tiempos límite
    host_response_deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payout_scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    payout_released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Estado del pago
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid")

    # Reseñas
    guest_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    host_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Metadata adicional (e.g., datos de check-in, instrucciones)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)

    # Relaciones
    reservation_property: Mapped["Property"] = relationship(
        "Property", foreign_keys=[property_id], lazy="selectin"
    )
    guest: Mapped["User"] = relationship(
        "User", foreign_keys=[guest_id], lazy="selectin"
    )
    host: Mapped["User"] = relationship(
        "User", foreign_keys=[host_id], lazy="selectin"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="reservation", lazy="selectin"
    )

    __table_args__ = (
        CheckConstraint("check_out > check_in", name="chk_checkout_after_checkin"),
        CheckConstraint("guests_count > 0", name="chk_guests_positive"),
        CheckConstraint("total_amount > 0", name="chk_total_positive"),
        CheckConstraint(
            "status IN ('pending','confirmed','rejected','cancelled_guest',"
            "'cancelled_host','completed')",
            name="chk_reservation_status",
        ),
    )

    @property
    def is_active(self) -> bool:
        return self.status in ("pending", "confirmed")

    @property
    def can_be_cancelled_by_guest(self) -> bool:
        return self.status in ("pending", "confirmed")

    @property
    def can_be_cancelled_by_host(self) -> bool:
        return self.status in ("pending", "confirmed")

    def __repr__(self) -> str:
        return (
            f"<Reservation id={self.id} status={self.status} "
            f"check_in={self.check_in} check_out={self.check_out}>"
        )
