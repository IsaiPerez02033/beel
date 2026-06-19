"""Router de usuarios."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db
from app.modules.users import service
from app.modules.users.schemas import (
    BecomeHostIn,
    UserGoogleIn,
    UserLoginIn,
    UserMeOut,
    UserPublicOut,
    UserRegisterIn,
    UserUpdateIn,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── NextAuth — endpoints públicos ──────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(
    data: UserRegisterIn,
    db: AsyncSession = Depends(get_db),
):
    """Registro con email y contraseña."""
    user = await service.create_user_credentials(
        db, data.email, data.password, data.full_name
    )
    await db.commit()
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name}


@router.post("/login")
async def login(
    data: UserLoginIn,
    db: AsyncSession = Depends(get_db),
):
    """Login con email y contraseña (llamado por NextAuth internamente)."""
    user = await service.get_user_by_email(db, data.email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not await service.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


@router.post("/oauth/google")
async def oauth_google(
    data: UserGoogleIn,
    db: AsyncSession = Depends(get_db),
):
    """Registro/login con Google OAuth."""
    user = await service.get_or_create_google_user(
        db, data.email, data.full_name, data.google_id, data.avatar_url
    )
    await db.commit()
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


# ── Endpoints autenticados ─────────────────────────────────────────────────────


@router.get("/me", response_model=UserMeOut)
async def get_me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el perfil completo del usuario autenticado."""
    import uuid as uuid_mod
    user_id = uuid_mod.UUID(current_user.sub)
    user = await service.get_user_by_id(db, user_id)
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
    user_id = uuid_mod.UUID(current_user.sub)
    user = await service.get_user_by_id(db, user_id)
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
    user_id = uuid_mod.UUID(current_user.sub)
    user = await service.get_user_by_id(db, user_id)
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
