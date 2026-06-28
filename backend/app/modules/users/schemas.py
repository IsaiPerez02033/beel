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


class HostReviewOut(BaseModel):
    """Reseña de un huésped sobre una propiedad del anfitrión."""
    id: uuid.UUID
    reviewer_name: str
    reviewer_avatar: Optional[str] = None
    overall_rating: int
    comment: Optional[str] = None
    property_title: Optional[str] = None
    created_at: datetime


class HostProfileOut(BaseModel):
    """Perfil público de anfitrión con métricas, propiedades y reseñas."""
    id: uuid.UUID
    full_name: str
    avatar_url: Optional[str]
    is_identity_verified: bool
    role: str
    host_since: Optional[datetime]
    created_at: datetime
    total_listings: int
    avg_rating: Optional[float] = None
    total_reviews: int = 0
    properties: list = []
    reviews: list[HostReviewOut] = []


class UserMeOut(BaseModel):
    """Info completa del usuario autenticado (/users/me)."""
    id: uuid.UUID
    clerk_id: Optional[str] = None
    email: str
    full_name: str
    avatar_url: Optional[str]
    phone: Optional[str]
    phone_country_code: Optional[str] = None
    role: str
    is_phone_verified: bool
    is_identity_verified: bool
    identity_status: str = "none"
    is_active: bool
    preferred_language: str
    host_since: Optional[datetime]
    total_listings: int
    total_trips: int
    created_at: datetime
    updated_at: datetime

    # Datos bancarios (cobros)
    bank_name: Optional[str] = None
    bank_clabe: Optional[str] = None
    bank_account_holder: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Mutaciones ────────────────────────────────────────────────────────────────

class UserUpdateIn(BaseModel):
    """Campos que el usuario puede actualizar en su perfil."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = Field(None, max_length=30)
    phone_country_code: Optional[str] = Field(None, max_length=5)
    preferred_language: Optional[str] = Field(None, pattern="^(es|en|pt)$")
    avatar_url: Optional[str] = Field(None, max_length=1000)
    bank_name: Optional[str] = Field(None, max_length=100)
    bank_clabe: Optional[str] = Field(None, max_length=50)
    bank_account_holder: Optional[str] = Field(None, max_length=255)


class PhoneSendIn(BaseModel):
    """Solicitud para enviar código de verificación de teléfono."""
    phone: str = Field(..., min_length=8, max_length=20)        # número local o E.164
    country_code: str = Field("+52", max_length=5)
    channel: str = Field("sms", pattern="^(sms|whatsapp)$")


class PhoneVerifyIn(BaseModel):
    """Solicitud para verificar el código del teléfono."""
    code: str = Field(..., min_length=4, max_length=10)


class BecomeHostIn(BaseModel):
    """Solicitud para convertirse en anfitrión."""
    accepts_terms: bool

    @field_validator("accepts_terms")
    @classmethod
    def must_accept(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debes aceptar los términos para ser anfitrión")
        return v


# ── NextAuth — registro y login ────────────────────────────────────────────────

class UserRegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2)


class UserLoginIn(BaseModel):
    email: EmailStr
    password: str


class UserGoogleIn(BaseModel):
    email: EmailStr
    full_name: str
    google_id: str
    avatar_url: Optional[str] = None


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
