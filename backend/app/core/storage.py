"""
Servicio de almacenamiento de archivos en Supabase Storage para Beel.

Usa la API REST de Supabase Storage vía httpx (sin dependencias extra).
Mantiene la misma interfaz que la versión anterior de S3 para no romper callers.

Uso:
    from app.core.storage import upload_photo, delete_photo

    url, key = await upload_photo(file_bytes, "image/jpeg", "properties/uuid/")
    await delete_photo(key)

Configuración requerida (.env):
    SUPABASE_URL=https://xxxxx.supabase.co
    SUPABASE_SERVICE_KEY=eyJhbGci...   (service_role key, NO el anon key)
    SUPABASE_STORAGE_BUCKET=beel-media (bucket público)
"""

import logging
import uuid
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
}


def storage_configured() -> bool:
    """Retorna True si Supabase Storage está configurado."""
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


# Alias retrocompatible (los routers llaman s3_configured)
def s3_configured() -> bool:
    return storage_configured()


def _public_url(key: str) -> str:
    """URL pública de un objeto en un bucket público de Supabase Storage."""
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    return f"{base}/storage/v1/object/public/{bucket}/{key}"


async def upload_photo(
    file_bytes: bytes,
    content_type: str,
    prefix: str = "properties/",
    filename: Optional[str] = None,
) -> tuple[str, str]:
    """
    Sube una foto a Supabase Storage y retorna (url_publica, key).

    Raises:
        ValueError: formato no permitido o archivo muy grande
        RuntimeError: storage no configurado o error de subida
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Formato no permitido: {content_type}. Usa JPEG, PNG o WebP.")

    if len(file_bytes) > settings.MAX_PHOTO_SIZE_BYTES:
        max_mb = settings.MAX_PHOTO_SIZE_BYTES // (1024 * 1024)
        raise ValueError(f"El archivo excede el tamaño máximo de {max_mb} MB.")

    if not storage_configured():
        raise RuntimeError(
            "Supabase Storage no está configurado. "
            "Agrega SUPABASE_URL y SUPABASE_SERVICE_KEY al .env"
        )

    ext = ALLOWED_CONTENT_TYPES[content_type]
    key = f"{prefix.rstrip('/')}/{filename or uuid.uuid4()}.{ext}"

    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    url = f"{base}/storage/v1/object/{bucket}/{key}"

    headers = {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
        "Cache-Control": "public, max-age=31536000",
        # upsert para permitir reemplazar la misma ruta (ej. avatar)
        "x-upsert": "true",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, content=file_bytes, headers=headers)
        if resp.status_code not in (200, 201):
            logger.error("Error subiendo a Supabase Storage [%s]: %s", resp.status_code, resp.text)
            raise RuntimeError("Error al subir la foto. Intenta de nuevo.")
        logger.info("Foto subida a Supabase Storage: %s", key)
        return _public_url(key), key
    except httpx.HTTPError as e:
        logger.error("Error de red subiendo a Supabase Storage: %s", e)
        raise RuntimeError("Error al subir la foto. Intenta de nuevo.") from e


async def delete_photo(key: str) -> None:
    """Elimina un objeto de Supabase Storage. Falla silenciosamente si no existe."""
    if not storage_configured() or not key:
        return
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_STORAGE_BUCKET
    url = f"{base}/storage/v1/object/{bucket}/{key}"
    headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            await client.delete(url, headers=headers)
        logger.info("Foto eliminada de Supabase Storage: %s", key)
    except httpx.HTTPError as e:
        logger.warning("Error eliminando foto %s: %s", key, e)
