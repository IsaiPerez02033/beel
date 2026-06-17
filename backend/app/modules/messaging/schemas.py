"""Pydantic schemas para mensajería."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    message_type: str
    content: Optional[str]
    metadata_: Optional[dict] = Field(None, alias="metadata")
    is_read: bool
    deleted_by_sender: bool = False
    read_at: Optional[datetime]
    created_at: datetime
    sender: Optional[ParticipantOut] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


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
