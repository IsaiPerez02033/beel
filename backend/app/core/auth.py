"""
Verificación de JWT de NextAuth para FastAPI.

NextAuth emite JWTs HS256 firmados con NEXTAUTH_SECRET.
El mismo secreto se comparte entre frontend y backend.
El claim "sub" del JWT contiene el UUID del usuario en la BD de Beel.
"""

import logging
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


def _verify_token(token: str) -> dict:
    """Valida el JWT HS256 de NextAuth y retorna los claims."""
    try:
        payload = jwt.decode(
            token,
            settings.NEXTAUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


class BeelUser:
    """Datos del usuario extraídos del JWT de NextAuth + consulta a BD."""

    def __init__(self, claims: dict, db_user):
        # id = UUID real del usuario en la BD de Beel (funciona para credentials Y Google).
        # NO usar 'sub' del token como UUID — para Google es un número, no un UUID.
        self.id = db_user.id if db_user else None
        self.sub: str = claims.get("sub", "")
        self.email: Optional[str] = db_user.email if db_user else claims.get("email")
        self.full_name: Optional[str] = db_user.full_name if db_user else claims.get("name")
        self.avatar_url: Optional[str] = db_user.avatar_url if db_user else None
        self.role: str = db_user.role if db_user else claims.get("role", "guest")
        self.claims = claims
        self._db_user = db_user


async def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
) -> BeelUser:
    """
    Dependency que exige autenticación.
    Levanta 401 si no hay token o es inválido.
    """
    if not settings.NEXTAUTH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Autenticación no configurada",
        )
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _verify_token(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido: falta sub",
            headers={"WWW-Authenticate": "Bearer"},
        )

    from app.core.database import AsyncSessionLocal
    from app.modules.users.service import get_user_by_id as fetch_by_id, get_user_by_email
    from uuid import UUID as UuidType

    db_user = None

    if AsyncSessionLocal:
        async with AsyncSessionLocal() as db_session:
            # Intentar buscar por UUID (caso normal)
            try:
                uid = UuidType(user_id)
                db_user = await fetch_by_id(db_session, uid)
            except ValueError:
                # sub no es UUID — probablemente es el sub de Google (número)
                # Fallback: buscar por email si está en el token
                email = claims.get("email")
                if email:
                    logger.warning(
                        "sub '%s' no es UUID, buscando usuario por email '%s'",
                        user_id, email,
                    )
                    db_user = await get_user_by_email(db_session, email)

    if not db_user or not db_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o desactivado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return BeelUser(claims, db_user)


async def get_optional_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
) -> Optional[BeelUser]:
    """
    Dependency de auth opcional.
    Retorna None si no hay token; levanta 401 si el token es inválido.
    """
    if not credentials:
        return None
    return await get_current_user(credentials)


# Aliases con tipo para usar en rutas
CurrentUser = Annotated[BeelUser, Depends(get_current_user)]
OptionalUser = Annotated[Optional[BeelUser], Depends(get_optional_user)]
