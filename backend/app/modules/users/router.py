"""Router de usuarios."""

import uuid
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
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


@router.get("/check-email")
async def check_email(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Verifica si un email ya está registrado y con qué proveedor.
    Usado por el frontend para redirigir entre registro e inicio de sesión.
    """
    user = await service.get_user_by_email(db, email)
    if not user:
        return {"exists": False, "provider": None}
    return {"exists": True, "provider": user.provider}


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
    user_id = current_user.id
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
    user_id = current_user.id
    user = await service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    updated = await service.update_user(db, user, data)
    return updated


@router.post("/me/avatar", response_model=UserMeOut)
async def upload_avatar(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Sube una foto de perfil del usuario a S3 y actualiza avatar_url."""
    from app.core.storage import upload_photo as s3_upload, s3_configured, ALLOWED_CONTENT_TYPES

    user = await service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento de fotos no está configurado.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")

    file_bytes = await file.read()
    try:
        url, _ = await s3_upload(
            file_bytes=file_bytes,
            content_type=content_type,
            prefix=f"avatars/{user.id}",
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    user.avatar_url = url
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/become-host", response_model=UserMeOut)
async def become_host(
    data: BecomeHostIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Convierte al usuario en anfitrión."""
    user_id = current_user.id
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
