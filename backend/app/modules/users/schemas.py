"""Pydantic schemas para el módulo de usuarios."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Base ──────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    preferred_language: str = "es"
    avatar_url: Optional[str] = None


# ── Respuestas ────────────────────────────────────────────────────────────────

class HostPublicOut(BaseModel):
    """Info pública del anfitrión — se incluye en PropertyOut."""
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]
    is_identity_verified: bool
    host_since: Optional[datetime]
    total_listings: int

    model_config = {"from_attributes": True}


class UserPublicOut(BaseModel):
    """Info pública de un usuario (para perfiles)."""
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]
    is_identity_verified: bool
    role: str
    host_since: Optional[datetime]
    total_listings: int
    total_trips: int
    created_at: datetime

    model_config = {"from_attributes": True}


class UserMeOut(BaseModel):
    """Info completa del usuario autenticado (/users/me)."""
    id: uuid.UUID
    clerk_id: str
    email: str
    full_name: str
    avatar_url: Optional[str]
    phone: Optional[str]
    role: str
    is_phone_verified: bool
    is_identity_verified: bool
    is_active: bool
    preferred_language: str
    host_since: Optional[datetime]
    total_listings: int
    total_trips: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Mutaciones ────────────────────────────────────────────────────────────────

class UserUpdateIn(BaseModel):
    """Campos que el usuario puede actualizar en su perfil."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    preferred_language: Optional[str] = Field(None, pattern="^(es|en|pt)$")


class BecomeHostIn(BaseModel):
    """Solicitud para convertirse en anfitrión."""
    accepts_terms: bool

    @field_validator("accepts_terms")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debes aceptar los términos para ser anfitrión")
        return v


# ── Webhook de Clerk ──────────────────────────────────────────────────────────

class ClerkUserCreated(BaseModel):
    """Payload del evento user.created de Clerk."""
    id: str  # clerk_id
    email_addresses: list[dict]
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    image_url: Optional[str] = None

    @property
    def primary_email(self) -> Optional[str]:
        for e in self.email_addresses:
            if e.get("id") and e.get("email_address"):
                return e["email_address"]
        return None

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or "Usuario"
