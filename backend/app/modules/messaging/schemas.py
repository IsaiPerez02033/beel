"""Pydantic schemas para mensajería."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Participante ──────────────────────────────────────────────────────────────

class ParticipantOut(BaseModel):
    id: uuid.UUID
    full_name: str = "Usuario"
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_validator("full_name", mode="before")
    @classmethod
    def _default_full_name(cls, v):
        return v if v else "Usuario"


# ── Mensaje ───────────────────────────────────────────────────────────────────

class ReplyPreviewOut(BaseModel):
    """Vista reducida del mensaje citado (para mostrar dentro de la burbuja)."""
    id: uuid.UUID
    sender_id: uuid.UUID
    content: Optional[str] = None
    sender_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ReactionOut(BaseModel):
    """Reacción agrupada: emoji + lista de user_ids que la pusieron."""
    emoji: str
    count: int
    user_ids: list[uuid.UUID]


class MessageOut(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    reply_to_id: Optional[uuid.UUID] = None
    reply_to: Optional[ReplyPreviewOut] = None
    message_type: str = "text"
    content: Optional[str] = None
    reactions: list[ReactionOut] = []
    # OJO: la columna en BD se llama "metadata", pero ese nombre choca con el
    # atributo reservado SQLAlchemy `Base.metadata` (un objeto MetaData()).
    # En el modelo el JSONB real vive en `metadata_`, así que leemos de ahí
    # (validation_alias) y serializamos como "metadata" (serialization_alias).
    metadata_: Optional[dict] = Field(
        None, validation_alias="metadata_", serialization_alias="metadata"
    )
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

    @field_validator("metadata_", mode="before")
    @classmethod
    def _clean_metadata(cls, v):
        return v if isinstance(v, dict) else None

    @field_validator("reply_to", mode="before")
    @classmethod
    def _build_reply_preview(cls, v):
        if v is None or isinstance(v, dict):
            return v
        sender = getattr(v, "sender", None)
        return {
            "id": v.id,
            "sender_id": v.sender_id,
            "content": v.content,
            "sender_name": getattr(sender, "full_name", None) if sender else None,
        }

    @field_validator("reactions", mode="before")
    @classmethod
    def _group_reactions(cls, v):
        """Agrupa lista de ORM MessageReaction en [{ emoji, count, user_ids }]."""
        if not v or isinstance(v, list) and (not v or isinstance(v[0], dict)):
            return v or []
        from collections import defaultdict
        groups: dict = defaultdict(list)
        for r in v:
            groups[r.emoji].append(r.user_id)
        return [{"emoji": e, "count": len(uids), "user_ids": uids} for e, uids in groups.items()]


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
    body: str = Field(..., min_length=1, max_length=4000)
    message_type: str = Field(default="text", pattern="^(text|system)$")
    metadata: Optional[dict] = None
    reply_to_id: Optional[uuid.UUID] = None


class ReactionIn(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=10)


class ConversationStartIn(BaseModel):
    """Iniciar conversación con un host (desde página de propiedad)."""
    host_id: uuid.UUID
    property_id: Optional[uuid.UUID] = None
    reservation_id: Optional[uuid.UUID] = None
    first_message: str = Field(..., min_length=1, max_length=4000)
