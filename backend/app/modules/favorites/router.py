"""Router de favoritos."""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.favorites import service
from app.modules.properties.schemas import PropertyCardOut

router = APIRouter()


@router.get("/ids", response_model=list[uuid.UUID])
async def get_favorite_ids(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """IDs de las propiedades favoritas del usuario (para marcar corazones)."""
    return await service.list_favorite_ids(db, current_user.id)


@router.get("", response_model=list[PropertyCardOut])
async def get_favorites(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Propiedades favoritas del usuario."""
    props = await service.list_favorites(db, current_user.id)
    return [PropertyCardOut.model_validate(p) for p in props]


@router.put("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    property_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Marca una propiedad como favorita."""
    await service.add_favorite(db, current_user.id, property_id)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    property_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Quita una propiedad de favoritos."""
    await service.remove_favorite(db, current_user.id, property_id)
