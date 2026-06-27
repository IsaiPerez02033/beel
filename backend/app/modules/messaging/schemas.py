"""Pydantic schemas para mensajería."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ── Participante ──────────────────────────────────────────────────────────────

class ParticipantOut(BaseModel):
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


# ── Mensaje ───────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    message_type: str = "text"
    content: Optional[str] = None
    metadata_: Optional[dict] = Field(None, alias="metadata")
    is_read: bool = False
    deleted_by_sender: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime
    sender: Optional[ParticipantOut] = None

    model_config = {"from_attributes": True, "populate_by_name": True}

    # Defensa: un registro recién insertado (flush sin commit) puede llegar con
    # created_at=None, y campos no nulos pueden venir None por drift histórico.
    # Rellenamos en lugar de tirar un 500 que rompería el envío/lectura.
    @field_validator("created_at", mode="before")
    @classmethod
    def _default_created_at(cls, v):
        return v if v is not None else datetime.now(timezone.utc)

    @field_validator("message_type", mode="before")
    @classmethod
    def _default_message_type(cls, v):
        return v if v else "text"

    @field_validator("is_read", "deleted_by_sender", mode="before")
    @classmethod
    def _default_bool(cls, v):
        return bool(v) if v is not None else False


class MessageListOut(BaseModel):
    messages: list[MessageOut]
    total: int
    has_more: bool


# ── Conversación ──────────────────────────────────────────────────────────────

class ConversationOut(BaseModel):
    id: uuid.UUID
    guest_id: uuid.UUID
    host_id: uuid.UUID
    property_id: Optional[uuid.UUID]
    reservation_id: Optional[uuid.UUID]
    last_message_at: Optional[datetime]
    last_message_preview: Optional[str]
    unread_count_guest: int
    unread_count_host: int
    guest: Optional[ParticipantOut] = None
    host: Optional[ParticipantOut] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationListOut(BaseModel):
    conversations: list[ConversationOut]
    total: int


# ── Mutaciones ────────────────────────────────────────────────────────────────

class MessageCreateIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)  # input field, mapped to 'content' in DB
    message_type: str = Field(default="text", pattern="^(text|system)$")
    metadata: Optional[dict] = None


class ConversationStartIn(BaseModel):
    """Iniciar conversación con un host (desde página de propiedad)."""
    host_id: uuid.UUID
    property_id: Optional[uuid.UUID] = None
    reservation_id: Optional[uuid.UUID] = None
    first_message: str = Field(..., min_length=1, max_length=4000)
