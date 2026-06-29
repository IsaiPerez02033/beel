"""Lógica de favoritos."""

import uuid
import logging

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.favorites.models import Favorite
from app.modules.properties.models import Property, PropertyAmenity

logger = logging.getLogger(__name__)


async def add_favorite(db: AsyncSession, user_id: uuid.UUID, property_id: uuid.UUID) -> None:
    """Marca una propiedad como favorita (idempotente)."""
    existing = await db.execute(
        select(Favorite).where(
            Favorite.user_id == user_id, Favorite.property_id == property_id
        )
    )
    if existing.scalar_one_or_none():
        return
    db.add(Favorite(user_id=user_id, property_id=property_id))
    await db.flush()


async def remove_favorite(db: AsyncSession, user_id: uuid.UUID, property_id: uuid.UUID) -> None:
    """Quita una propiedad de favoritos (idempotente)."""
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == user_id, Favorite.property_id == property_id
        )
    )
    await db.flush()


async def list_favorite_ids(db: AsyncSession, user_id: uuid.UUID) -> list[uuid.UUID]:
    """IDs de las propiedades favoritas del usuario."""
    result = await db.execute(
        select(Favorite.property_id).where(Favorite.user_id == user_id)
    )
    return [row[0] for row in result.all()]


async def list_favorites(db: AsyncSession, user_id: uuid.UUID) -> list[Property]:
    """Propiedades favoritas del usuario (más recientes primero), solo activas."""
    result = await db.execute(
        select(Property)
        .join(Favorite, Favorite.property_id == Property.id)
        .options(
            selectinload(Property.host),
            selectinload(Property.photos),
            selectinload(Property.amenities).selectinload(PropertyAmenity.amenity),
        )
        .where(
            Favorite.user_id == user_id,
            Property.deleted_at.is_(None),
        )
        .order_by(Favorite.created_at.desc())
    )
    return list(result.scalars().all())
