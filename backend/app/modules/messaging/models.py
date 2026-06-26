"""
Modelos SQLAlchemy para mensajería.

Diseño transport-agnostic:
  - El schema no cambia si migramos de SSE a WebSockets.
  - Una Conversation agrupa a exactamente dos participantes (guest + host).
  - Los mensajes son append-only.
  - read_at se actualiza por polling o evento SSE de confirmación.

Tipos de mensaje:
  text          → mensaje de texto normal
  system        → mensaje automático del sistema (reserva confirmada, etc.)
  image         → foto adjunta (URL de S3)
  reservation   → tarjeta de reserva embebida
"""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index,
    String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.modules.users.models import User


class Conversation(Base):
    """
    Hilo de mensajes entre un guest y un host.
    Una sola conversación por par (guest_id, host_id, property_id).
    """
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    guest_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    host_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    property_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="SET NULL"),
    )
    reservation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("reservations.id", ondelete="SET NULL"),
    )

    # Últimos mensajes cacheados (evita JOIN al listar inbox)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_message_preview: Mapped[Optional[str]] = mapped_column(String(255))

    # Contadores de no leídos por participante
    unread_count_guest: Mapped[int] = mapped_column("unread_count_guest", default=0)
    unread_count_host: Mapped[int] = mapped_column("unread_count_host", default=0)

    is_pre_booking: Mapped[bool] = mapped_column("is_pre_booking", Boolean, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    last_message_sender_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relaciones
    guest: Mapped["User"] = relationship("User", foreign_keys=[guest_id], lazy="selectin")
    host: Mapped["User"] = relationship("User", foreign_keys=[host_id], lazy="selectin")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", lazy="noload",
        order_by="Message.created_at",
    )

    __table_args__ = (
        # Una sola conversación por (guest, host, propiedad)
        UniqueConstraint("guest_id", "host_id", "property_id", name="uq_conversation"),
        Index("idx_conversations_guest", "guest_id"),
        Index("idx_conversations_host", "host_id"),
    )

    def __repr__(self) -> str:
        return f"<Conversation id={self.id} guest={self.guest_id} host={self.host_id}>"


class Message(Base):
    """Mensaje individual dentro de una conversación."""
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    message_type: Mapped[str] = mapped_column(String(20), default="text")
    content: Mapped[str] = mapped_column("content", Text, nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deleted_by_sender: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relaciones
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id], lazy="selectin")

    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Message id={self.id} type={self.message_type} sender={self.sender_id}>"
