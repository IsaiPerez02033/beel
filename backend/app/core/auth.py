"""
Verificación de JWT de Clerk para FastAPI.

Clerk emite JWTs RS256. Este módulo:
  1. Descarga el JWKS de Clerk una vez y lo cachea.
  2. Valida la firma, expiración y claims del token en cada request.
  3. Expone get_current_user (requiere auth) y get_optional_user (auth opcional).

Uso en un router:
    from app.core.auth import get_current_user, CurrentUser

    @router.get("/me")
    async def me(user: CurrentUser):
        return user
"""

import asyncio
import logging
from typing import Annotated, Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# Bearer extractor — auto_error=False para auth opcional
bearer_scheme = HTTPBearer(auto_error=False)

# Cache en memoria del JWKS (se refresca si falla la validación)
_jwks_cache: Optional[dict] = None
_jwks_lock = asyncio.Lock()


async def _get_jwks() -> dict:
    """Descarga y cachea el JWKS de Clerk con lock para concurrencia."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    async with _jwks_lock:
        if _jwks_cache:
            return _jwks_cache

    # El JWKS URL se deriva del publishable key
    # pk_test_xxx → frontend API: https://xxx.clerk.accounts.dev
    publishable_key = settings.CLERK_PUBLISHABLE_KEY
    # Clerk JWKS endpoint estándar
    jwks_url = f"https://{_extract_clerk_domain(publishable_key)}/.well-known/jwks.json"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        logger.info("JWKS de Clerk cargado desde %s", jwks_url)
        return _jwks_cache


def _extract_clerk_domain(publishable_key: str) -> str:
    """
    Extrae el dominio del Clerk Frontend API del publishable key.
    Formato: pk_test_<base64url> o pk_live_<base64url>
    El payload decodificado contiene la URL del frontend API.
    """
    import base64
    try:
        parts = publishable_key.split("_")
        # La parte codificada es el tercer segmento
        encoded = parts[2]
        # Añadir padding si falta
        padded = encoded + "=" * (4 - len(encoded) % 4)
        decoded = base64.urlsafe_b64decode(padded).decode("utf-8").rstrip("$")
        return decoded
    except Exception:
        # Fallback: usar el dominio por defecto de Clerk
        return "clerk.accounts.dev"


async def _verify_token(token: str, clerk_domain: str) -> dict:
    """Valida el JWT de Clerk y retorna los claims."""
    global _jwks_cache
    expected_iss = f"https://api.clerk.com" if "clerk.accounts.dev" in clerk_domain else clerk_domain

    try:
        jwks = await _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_iss": False},
        )
        # Validar iss manualmente (soporta múltiples formatos)
        token_iss = payload.get("iss", "")
        if not token_iss or not (
            token_iss.startswith("https://clerk.") or "clerk.accounts.dev" in token_iss or "clerk" in token_iss.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token issuer inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except JWTError as e:
        # Refrescar JWKS y reintentar una vez (clave rotada)
        async with _jwks_lock:
            _jwks_cache = None
        try:
            jwks = await _get_jwks()
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["RS256"],
                options={"verify_aud": False, "verify_iss": False},
            )
            token_iss = payload.get("iss", "")
            if not token_iss or not (
                token_iss.startswith("https://clerk.") or "clerk.accounts.dev" in token_iss or "clerk" in token_iss.lower()
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token issuer inválido",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return payload
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o expirado",
                headers={"WWW-Authenticate": "Bearer"},
            ) from e


class ClerkUser:
    """Datos del usuario extraídos del JWT de Clerk."""

    def __init__(self, claims: dict):
        self.clerk_id: str = claims["sub"]
        self.email: Optional[str] = claims.get("email")
        self.full_name: Optional[str] = (
            f"{claims.get('first_name', '')} {claims.get('last_name', '')}".strip()
            or claims.get("name")
        )
        self.avatar_url: Optional[str] = claims.get("image_url")
        self.claims = claims


async def get_current_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
) -> ClerkUser:
    """
    Dependency que exige autenticación.
    Levanta 401 si no hay token o es inválido.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación",
            headers={"WWW-Authenticate": "Bearer"},
        )
    claims = await _verify_token(
        credentials.credentials,
        _extract_clerk_domain(settings.CLERK_PUBLISHABLE_KEY),
    )
    return ClerkUser(claims)


async def get_optional_user(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme)
    ],
) -> Optional[ClerkUser]:
    """
    Dependency de auth opcional.
    Retorna None si no hay token; levanta 401 si el token es inválido.
    """
    if not credentials:
        return None
    claims = await _verify_token(
        credentials.credentials,
        _extract_clerk_domain(settings.CLERK_PUBLISHABLE_KEY),
    )
    return ClerkUser(claims)


# Aliases con tipo para usar en rutas
CurrentUser = Annotated[ClerkUser, Depends(get_current_user)]
OptionalUser = Annotated[Optional[ClerkUser], Depends(get_optional_user)]
