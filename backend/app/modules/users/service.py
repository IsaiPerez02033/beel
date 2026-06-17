"""Lógica de negocio para el módulo de usuarios."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

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
