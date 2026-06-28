"""
Modelo SQLAlchemy para usuarios de Beel.

Los usuarios pueden autenticarse vía NextAuth (credentials/Google)
o vía Clerk (legacy, en transición). Este modelo almacena
la info de perfil + datos propios de Beel.
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

    # Vínculo con Clerk (legacy, nullable para nuevos usuarios NextAuth)
    clerk_id: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )

    # NextAuth — credentials
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # NextAuth — Google OAuth
    google_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    provider: Mapped[str] = mapped_column(String(50), default="credentials")

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

    # Verificación de identidad (Didit) y teléfono
    identity_session_id: Mapped[Optional[str]] = mapped_column(String(255))
    identity_status: Mapped[str] = mapped_column(String(30), default="none")  # none|pending|approved|declined
    identity_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    phone_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Preferencias
    preferred_language: Mapped[str] = mapped_column(String(5), default="es")

    # Datos bancarios para cobrar
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    bank_clabe: Mapped[Optional[str]] = mapped_column(String(50))
    bank_account_holder: Mapped[Optional[str]] = mapped_column(String(255))
    # Auditoría legal: quién registró la CLABE, cuándo y desde dónde
    bank_clabe_set_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    bank_clabe_set_ip: Mapped[Optional[str]] = mapped_column(String(45))

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
