"""
Modelos SQLAlchemy para reseñas.

Diseño:
  - Una reseña por (reservation_id, reviewer_id) — una por estancia.
  - Las reseñas son bidireccionales: guest reseña al host y al espacio;
    host reseña al guest.
  - Calificaciones granulares (5 dimensiones) para mayor utilidad.
  - Las métricas de la propiedad se actualizan con un trigger de PostgreSQL
    o en el service después de cada reseña.
  - Ventana de 7 días post check-out para dejar reseña (REVIEW_WINDOW_DAYS).
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey,
    Numeric, SmallInteger, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.properties.models import Property
    from app.modules.reservations.models import Reservation


class Review(Base, TimestampMixin):
    """
    Reseña de una estancia.

    reviewer_type = 'guest' → guest reseña la propiedad y al host
    reviewer_type = 'host'  → host reseña al guest
    """
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reservation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reviewer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reviewed_id: Mapped[uuid.UUID] = mapped_column(
        "reviewee_id",
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    review_type: Mapped[str] = mapped_column("review_type", nullable=False)

    overall_rating: Mapped[int] = mapped_column("overall_rating", SmallInteger, nullable=False)

    cleanliness_rating: Mapped[Optional[int]] = mapped_column("cleanliness_rating", SmallInteger)
    communication_rating: Mapped[Optional[int]] = mapped_column("communication_rating", SmallInteger)
    location_rating: Mapped[Optional[int]] = mapped_column("location_rating", SmallInteger)
    value_rating: Mapped[Optional[int]] = mapped_column("value_rating", SmallInteger)

    # Texto
    comment: Mapped[Optional[str]] = mapped_column(Text)

    # Respuesta del host a la reseña del guest
    response_text: Mapped[Optional[str]] = mapped_column("response_text", Text)
    response_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    is_published: Mapped[bool] = mapped_column("is_published", default=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    flagged: Mapped[bool] = mapped_column(default=False)

    # Relaciones
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewer_id], lazy="selectin")
    reviewed: Mapped["User"] = relationship("User", foreign_keys=[reviewed_id], lazy="selectin")
    reservation: Mapped["Reservation"] = relationship("Reservation", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("reservation_id", "review_type", name="uq_review_per_stay"),
        CheckConstraint("overall_rating BETWEEN 1 AND 5", name="chk_rating"),
        CheckConstraint(
            "cleanliness_rating IS NULL OR cleanliness_rating BETWEEN 1 AND 5",
            name="chk_cleanliness",
        ),
        CheckConstraint(
            "review_type IN ('guest_to_host', 'host_to_guest')",
            name="chk_reviewer_type",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<Review id={self.id} type={self.review_type} "
            f"rating={self.overall_rating} reservation={self.reservation_id}>"
        )
