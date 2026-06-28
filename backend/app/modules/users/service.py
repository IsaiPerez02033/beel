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
    # Refrescar para cargar valores generados por la BD (p.ej. updated_at vía
    # trigger) en __dict__, evitando lazy-loads durante la serialización de la
    # respuesta cuando la sesión ya cerró (DetachedInstanceError).
    await db.refresh(user)
    return user


async def become_host(db: AsyncSession, user: User) -> User:
    """Eleva el rol del usuario a 'host'."""
    if user.role == "guest":
        user.role = "host"
        user.host_since = datetime.now(timezone.utc)
        await db.flush()
        logger.info("Usuario %s ahora es anfitrión", user.id)
    return user


async def maybe_promote_to_host(db: AsyncSession, user: User) -> User:
    """Promueve a 'host' si el usuario ya completó ambas verificaciones.
    En Beel, estar verificado (teléfono + identidad) ES el requisito para
    ser anfitrión, así que el rol se eleva automáticamente."""
    if user.role == "guest" and user.is_phone_verified and user.is_identity_verified:
        await become_host(db, user)
    return user


async def soft_delete_user(db: AsyncSession, user: User) -> None:
    """Soft-delete: marca deleted_at pero preserva los datos."""
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.flush()
    logger.info("Usuario %s eliminado (soft delete)", user.id)


# ── NextAuth — credentials y OAuth ─────────────────────────────────────────────


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Busca un usuario por email (case-insensitive, activo, no eliminado)."""
    from sqlalchemy import func
    result = await db.execute(
        select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        )
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
        if existing.provider == "google":
            raise HTTPException(
                status_code=400,
                detail="Este correo ya tiene una cuenta con Google. Usa 'Continuar con Google' para iniciar sesión.",
            )
        raise HTTPException(status_code=400, detail="Este correo ya está registrado. Inicia sesión.")

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
    # Email de bienvenida
    import asyncio
    asyncio.ensure_future(_send_welcome_email(email, full_name))
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
    # Email de bienvenida
    import asyncio
    asyncio.ensure_future(_send_welcome_email(email, full_name))
    return user


async def _send_welcome_email(email: str, full_name: str) -> None:
    """Envía email de bienvenida a nuevos usuarios."""
    try:
        from app.core.email import _send
        from app.core.config import settings
        frontend = settings.FRONTEND_URL or "https://www.beel-mx.com"
        first_name = full_name.split()[0] if full_name else "viajero"
        await _send(
            to_email=email,
            to_name=full_name,
            subject="¡Bienvenido a Beel! 🌿",
            html=f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Bienvenido a Beel</title></head>
<body style="margin:0;padding:0;background:#F1EFE8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFE8;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:32px;font-weight:700;color:#147A5C;letter-spacing:-1px;">beel</span>
        </td></tr>

        <tr><td style="background:#FFFFFF;border-radius:16px;padding:40px 32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

          <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;color:#2C2C2A;letter-spacing:-0.5px;">
            ¡Hola, {first_name}! 👋
          </h1>
          <p style="margin:0 0 24px;font-size:16px;color:#5C5A57;line-height:1.6;">
            Bienvenido a <strong style="color:#147A5C;">Beel</strong> — hospedajes auténticos con anfitriones locales en todo México.
          </p>

          <div style="background:#F8F7F4;border-radius:12px;padding:20px 24px;margin-bottom:28px;border-left:4px solid #147A5C;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#2C2C2A;">¿Qué puedes hacer en Beel?</p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td style="padding:4px 0;font-size:14px;color:#5C5A57;">🏠 &nbsp;Encuentra hospedajes únicos en México</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;color:#5C5A57;">🔒 &nbsp;Pagos seguros con protección Beel</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;color:#5C5A57;">💬 &nbsp;Comunícate directo con los anfitriones</td></tr>
              <tr><td style="padding:4px 0;font-size:14px;color:#5C5A57;">⭐ &nbsp;Reseñas reales de huéspedes verificados</td></tr>
            </table>
          </div>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="{frontend}/buscar"
               style="display:inline-block;background:#F5A623;color:#2C2C2A;padding:14px 36px;border-radius:12px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
              Explorar hospedajes →
            </a>
          </div>

          <hr style="border:none;border-top:1px solid #EBEBEB;margin:0 0 20px;">

          <p style="margin:0;font-size:13px;color:#9C9A96;text-align:center;line-height:1.6;">
            ¿Tienes una propiedad? <a href="{frontend}/ser-anfitrion" style="color:#147A5C;text-decoration:none;font-weight:500;">Conviértete en anfitrión</a>
            y empieza a ganar sin pagar comisión.
          </p>

        </td></tr>

        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9C9A96;">
            © 2026 Beel · México<br>
            <a href="{frontend}" style="color:#147A5C;text-decoration:none;">beel-mx.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
            """,
        )
    except Exception as e:
        logger.error("Error enviando email de bienvenida a %s: %s", email, e)
