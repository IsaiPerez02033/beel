"""Router de usuarios."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.modules.users import service
from app.modules.users.schemas import (
    BecomeHostIn,
    UserMeOut,
    UserPublicOut,
    UserUpdateIn,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/me", response_model=UserMeOut)
async def get_me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el perfil completo del usuario autenticado."""
    user = await service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado. Asegúrate de completar el registro.",
        )
    return user


@router.patch("/me", response_model=UserMeOut)
async def update_me(
    data: UserUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza el perfil del usuario autenticado."""
    user = await service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updated = await service.update_user(db, user, data)
    return updated


@router.post("/me/become-host", response_model=UserMeOut)
async def become_host(
    data: BecomeHostIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Convierte al usuario en anfitrión."""
    user = await service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updated = await service.become_host(db, user)
    return updated


@router.get("/{user_id}", response_model=UserPublicOut)
async def get_user_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el perfil público de un usuario."""
    user = await service.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user
