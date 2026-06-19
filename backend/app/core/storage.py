"""
Servicio de almacenamiento de archivos en AWS S3 para Beel.

Uso:
    from app.core.storage import upload_photo, delete_photo

    url = await upload_photo(file_bytes, "image/jpeg", "properties/uuid/")
    await delete_photo(s3_key)
"""

import logging
import uuid
from typing import Optional

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

_s3_client = None

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
}


def _get_s3():
    global _s3_client
    if _s3_client is not None:
        return _s3_client
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        return None
    try:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )
        return _s3_client
    except Exception as e:
        logger.error("Error inicializando cliente S3: %s", e)
        return None


def _public_url(key: str) -> str:
    """Construye la URL pública de un objeto en S3."""
    if settings.S3_BUCKET_URL:
        return f"{settings.S3_BUCKET_URL.rstrip('/')}/{key}"
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


async def upload_photo(
    file_bytes: bytes,
    content_type: str,
    prefix: str = "properties/",
    filename: Optional[str] = None,
) -> tuple[str, str]:
    """
    Sube una foto a S3 y retorna (url_publica, s3_key).

    Args:
        file_bytes: Contenido del archivo
        content_type: MIME type (image/jpeg, image/png, image/webp)
        prefix: Carpeta en S3 (ej. "properties/uuid/")
        filename: Nombre de archivo (se genera UUID si no se provee)

    Raises:
        ValueError: Si el content_type no es permitido o el archivo es muy grande
        RuntimeError: Si S3 no está configurado
    """
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValueError(f"Formato no permitido: {content_type}. Usa JPEG, PNG o WebP.")

    if len(file_bytes) > settings.MAX_PHOTO_SIZE_BYTES:
        max_mb = settings.MAX_PHOTO_SIZE_BYTES // (1024 * 1024)
        raise ValueError(f"El archivo excede el tamaño máximo de {max_mb} MB.")

    s3 = _get_s3()
    if not s3:
        raise RuntimeError("S3 no está configurado. Agrega AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY al .env")

    ext = ALLOWED_CONTENT_TYPES[content_type]
    key = f"{prefix.rstrip('/')}/{filename or uuid.uuid4()}.{ext}"

    try:
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",  # 1 año
        )
        url = _public_url(key)
        logger.info("Foto subida a S3: %s", key)
        return url, key
    except ClientError as e:
        logger.error("Error subiendo foto a S3: %s", e)
        raise RuntimeError("Error al subir la foto. Intenta de nuevo.") from e


async def delete_photo(s3_key: str) -> None:
    """Elimina un objeto de S3 por su key. Falla silenciosamente si no existe."""
    s3 = _get_s3()
    if not s3 or not s3_key:
        return
    try:
        s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        logger.info("Foto eliminada de S3: %s", s3_key)
    except ClientError as e:
        logger.warning("Error eliminando foto de S3 %s: %s", s3_key, e)


def s3_configured() -> bool:
    """Retorna True si S3 está configurado."""
    return bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.S3_BUCKET_NAME)
