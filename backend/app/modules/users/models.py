"""
Modelo SQLAlchemy para usuarios de Beel.

Los usuarios se autentican vía Clerk. Este modelo almacena
la info de perfil sincronizada desde Clerk + datos propios de Beel.
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.modules.properties.models import Property


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Vínculo con Clerk
    clerk_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )

    # Datos básicos
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    phone_country_code: Mapped[str] = mapped_column(String(5), default="+52")
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)

    # Rol y verificaciones
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="guest")
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_identity_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Preferencias
    preferred_language: Mapped[str] = mapped_column(String(5), default="es")

    # Métricas de negocio
    host_since: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_listings: Mapped[int] = mapped_column(Integer, default=0)
    total_trips: Mapped[int] = mapped_column(Integer, default=0)

    # Soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relaciones
    properties: Mapped[list["Property"]] = relationship(
        "Property",
        back_populates="host",
        foreign_keys="Property.host_id",
        lazy="noload",
    )

    @property
    def is_host(self) -> bool:
        return self.role in ("host", "admin")

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"
