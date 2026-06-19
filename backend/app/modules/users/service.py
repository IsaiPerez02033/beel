"""Lógica de negocio para el módulo de usuarios."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.users.schemas import ClerkUserCreated, UserUpdateIn

logger = logging.getLogger(__name__)


async def get_user_by_clerk_id(
    db: AsyncSession, clerk_id: str
) -> Optional[User]:
    result = await db.execute(
        select(User).where(User.clerk_id == clerk_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_user_by_id(
    db: AsyncSession, user_id: uuid.UUID
) -> Optional[User]:
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def upsert_user_from_clerk(
    db: AsyncSession, data: ClerkUserCreated
) -> User:
    """
    Crea o actualiza un usuario a partir del payload de Clerk.
    Llamado por el webhook user.created / user.updated.
    """
    existing = await get_user_by_clerk_id(db, data.id)

    if existing:
        # Actualizar datos que pueden cambiar en Clerk
        if data.primary_email:
            existing.email = data.primary_email
        existing.full_name = data.full_name
        if data.image_url:
            existing.avatar_url = data.image_url
        logger.info("Usuario actualizado desde Clerk: %s", data.id)
        return existing

    # Crear nuevo usuario
    user = User(
        clerk_id=data.id,
        email=data.primary_email or f"{data.id}@clerk.local",
        full_name=data.full_name,
        avatar_url=data.image_url,
        role="guest",
    )
    db.add(user)
    await db.flush()
    logger.info("Usuario creado desde Clerk: %s → %s", data.id, user.id)
    return user


async def update_user(
    db: AsyncSession, user: User, data: UserUpdateIn
) -> User:
    """Actualiza los campos del perfil del usuario."""
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    await db.flush()
    return user


async def become_host(db: AsyncSession, user: User) -> User:
    """Eleva el rol del usuario a 'host'."""
    if user.role == "guest":
        user.role = "host"
        user.host_since = datetime.now(timezone.utc)
        await db.flush()
        logger.info("Usuario %s ahora es anfitrión", user.id)
    return user


async def soft_delete_user(db: AsyncSession, user: User) -> None:
    """Soft-delete: marca deleted_at pero preserva los datos."""
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.flush()
    logger.info("Usuario %s eliminado (soft delete)", user.id)


# ── NextAuth — credentials y OAuth ─────────────────────────────────────────────


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Busca un usuario por email (activo, no eliminado)."""
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def verify_password(plain: str, hashed: str) -> bool:
    """Verifica contraseña contra hash bcrypt."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def create_user_credentials(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str,
) -> User:
    """Crea un usuario con email y contraseña."""
    existing = await get_user_by_email(db, email)
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user = User(
        email=email,
        full_name=full_name,
        password_hash=password_hash,
        provider="credentials",
        email_verified=False,
        role="guest",
        is_active=True,
        preferred_language="es",
    )
    db.add(user)
    await db.flush()
    logger.info("Usuario creado con credentials: %s", user.id)
    return user


async def get_or_create_google_user(
    db: AsyncSession,
    email: str,
    full_name: str,
    google_id: str,
    avatar_url: Optional[str] = None,
) -> User:
    """Crea o retorna usuario existente desde Google OAuth."""
    # Buscar por google_id primero
    result = await db.execute(
        select(User).where(User.google_id == google_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user:
        return user

    # Buscar por email
    user = await get_user_by_email(db, email)
    if user:
        user.google_id = google_id
        user.provider = "google"
        user.email_verified = True
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        await db.flush()
        return user

    # Crear nuevo
    user = User(
        email=email,
        full_name=full_name,
        google_id=google_id,
        avatar_url=avatar_url,
        provider="google",
        email_verified=True,
        role="guest",
        is_active=True,
        preferred_language="es",
    )
    db.add(user)
    await db.flush()
    logger.info("Usuario creado con Google OAuth: %s", user.id)
    return user
