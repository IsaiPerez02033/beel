"""Modelo SQLAlchemy para pagos."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if __import__("typing").TYPE_CHECKING:
    from app.modules.reservations.models import Reservation


class Payment(Base, TimestampMixin):
    """
    Registro de un intento de pago vía MercadoPago.

    Estados:
      pending    → preferencia creada, usuario aún no pagó
      approved   → pago aprobado por MP
      rejected   → pago rechazado
      refunded   → reembolso procesado
      in_process → pago en revisión por MP (ej. transferencia)
    """
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # MercadoPago IDs
    mp_preference_id: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    mp_merchant_order_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Montos
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="MXN")
    platform_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    host_payout: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))

    # Estado
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    payment_method: Mapped[Optional[str]] = mapped_column(String(100))
    failure_reason: Mapped[Optional[str]] = mapped_column(Text)

    # Respuesta raw de MP (para debugging / auditoría)
    mp_response: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Payout
    payout_status: Mapped[str] = mapped_column(String(30), default="pending")
    payout_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relaciones
    reservation: Mapped["Reservation"] = relationship(
        "Reservation", back_populates="payments", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<Payment id={self.id} status={self.status} "
            f"amount={self.amount} {self.currency}>"
        )
