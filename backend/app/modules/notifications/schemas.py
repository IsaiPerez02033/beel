import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: Optional[str]
    body: Optional[str]
    data: Optional[dict]
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    notifications: list[NotificationOut]
    total: int
    unread_count: int


# ── Web Push ──────────────────────────────────────────────────────────────────

class PushKeysIn(BaseModel):
    p256dh: str
    auth: str


class PushSubscribeIn(BaseModel):
    """Cuerpo de PushSubscription.toJSON() del navegador."""
    endpoint: str
    keys: PushKeysIn


class PushUnsubscribeIn(BaseModel):
    endpoint: str


class BroadcastIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=1, max_length=500)
    # "announcement" = aviso general, "promo" = promoción
    type: str = Field("announcement", pattern=r"^(announcement|promo)$")
    # Ruta interna a abrir al tocar la notificación (ej. /buscar?destino=Cancun)
    url: Optional[str] = Field(None, max_length=300, pattern=r"^/")
    # Segmento destino: todos, solo huéspedes o solo anfitriones
    audience: str = Field("all", pattern=r"^(all|guests|hosts)$")
