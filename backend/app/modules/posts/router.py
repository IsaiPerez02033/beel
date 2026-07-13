"""Router de publicaciones de anfitriones (feed estilo Instagram)."""

import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, OptionalUser
from app.core.database import get_db
from app.core.limiter import limiter
from app.modules.posts import service
from app.modules.posts.schemas import (
    DirectPostIn,
    LikeOut,
    PostFeedOut,
    PostOut,
    UploadUrlIn,
    UploadUrlOut,
)
from app.modules.users import service as user_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=PostFeedOut)
async def posts_feed(
    current_user: OptionalUser,
    cursor: Optional[datetime] = Query(None),
    per_page: int = Query(10, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Feed público de publicaciones (`liked` requiere sesión)."""
    return await service.get_feed(
        db, current_user.id if current_user else None, cursor, per_page
    )


@router.get("/mine", response_model=list[PostOut])
async def my_posts(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Publicaciones propias (para gestionarlas)."""
    return await service.my_posts(db, current_user.id)


@router.post("", response_model=PostOut, status_code=201)
@limiter.limit("10/minute")
async def create_post(
    request: Request,
    current_user: CurrentUser,
    files: list[UploadFile] = File(...),
    caption: Optional[str] = Form(None),
    property_id: Optional[uuid.UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Publica fotos en el feed. Solo anfitriones; hasta 5 fotos."""
    from app.core.storage import ALLOWED_CONTENT_TYPES, s3_configured
    from app.core.storage import upload_photo as storage_upload

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.is_host:
        raise HTTPException(status_code=403, detail="Solo los anfitriones pueden publicar")

    if property_id:
        from app.modules.properties.models import Property
        prop = await db.get(Property, property_id)
        if not prop or (prop.host_id != user.id and user.role != "admin"):
            raise HTTPException(status_code=400, detail="La propiedad no te pertenece")

    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento no está configurado.")

    if len(files) > service.MAX_MEDIA_PER_POST:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo {service.MAX_MEDIA_PER_POST} fotos por publicación",
        )

    media_items: list[dict] = []
    for f in files:
        content_type = f.content_type or ""
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")
        file_bytes = await f.read()
        try:
            url, storage_key = await storage_upload(
                file_bytes=file_bytes,
                content_type=content_type,
                prefix=f"posts/{user.id}",
            )
        except (ValueError, RuntimeError) as e:
            raise HTTPException(status_code=400, detail=str(e))
        media_items.append(
            {"media_url": url, "storage_key": storage_key, "media_type": "image"}
        )

    caption_clean = (caption or "").strip()[:500] or None
    post = await service.create_post(db, user, media_items, caption_clean, property_id)
    await db.commit()
    counts = await service._like_counts(db, [post.id])
    return service._post_dict(post, counts.get(post.id, 0), False)


@router.post("/upload-url", response_model=UploadUrlOut)
@limiter.limit("10/minute")
async def upload_url(
    request: Request,
    body: UploadUrlIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """URL firmada para subir un video DIRECTO a Supabase (evita el límite del
    proxy de Vercel). Solo anfitriones."""
    from app.core.config import settings
    from app.core.storage import (
        ALLOWED_VIDEO_CONTENT_TYPES,
        _public_url,
        create_signed_upload_url,
        s3_configured,
    )

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.is_host:
        raise HTTPException(status_code=403, detail="Solo los anfitriones pueden publicar")
    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento no está configurado.")

    if body.content_type not in ALLOWED_VIDEO_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa MP4, MOV o WebM.")
    if body.size_bytes > settings.MAX_VIDEO_SIZE_BYTES:
        max_mb = settings.MAX_VIDEO_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"El video no debe superar {max_mb} MB.")

    ext = ALLOWED_VIDEO_CONTENT_TYPES[body.content_type]
    key = f"posts/{user.id}/{uuid.uuid4()}.{ext}"
    try:
        signed = await create_signed_upload_url(key)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"upload_url": signed, "key": key, "public_url": _public_url(key)}


@router.post("/direct", response_model=PostOut, status_code=201)
@limiter.limit("10/minute")
async def create_post_direct(
    request: Request,
    body: DirectPostIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Registra una publicación cuya media ya se subió directo a Supabase."""
    from app.core.storage import _public_url

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.is_host:
        raise HTTPException(status_code=403, detail="Solo los anfitriones pueden publicar")

    if body.property_id:
        from app.modules.properties.models import Property
        prop = await db.get(Property, body.property_id)
        if not prop or (prop.host_id != user.id and user.role != "admin"):
            raise HTTPException(status_code=400, detail="La propiedad no te pertenece")

    media_items: list[dict] = []
    for m in body.media:
        # El bucket es público: solo aceptamos keys dentro de la carpeta del
        # propio anfitrión para que nadie registre objetos ajenos.
        if not m.key.startswith(f"posts/{user.id}/"):
            raise HTTPException(status_code=400, detail="Archivo no válido")
        if m.media_type not in ("image", "video"):
            raise HTTPException(status_code=400, detail="Tipo de media no válido")
        if m.media_type == "video" and m.duration_s and m.duration_s > 30:
            raise HTTPException(status_code=400, detail="El video no debe durar más de 30 segundos")
        media_items.append(
            {
                "media_url": _public_url(m.key),
                "storage_key": m.key,
                "media_type": m.media_type,
                "width": m.width,
                "height": m.height,
                "duration_s": m.duration_s,
            }
        )

    caption_clean = (body.caption or "").strip()[:500] or None
    post = await service.create_post(db, user, media_items, caption_clean, body.property_id)
    await db.commit()
    counts = await service._like_counts(db, [post.id])
    return service._post_dict(post, counts.get(post.id, 0), False)


@router.post("/{post_id}/like", response_model=LikeOut)
async def like_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await service.like_post(db, post_id, current_user.id, liked=True)
    await db.commit()
    return result


@router.delete("/{post_id}/like", response_model=LikeOut)
async def unlike_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await service.like_post(db, post_id, current_user.id, liked=False)
    await db.commit()
    return result


@router.delete("/{post_id}", status_code=200)
async def delete_post(
    post_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Borra una publicación propia (o cualquiera si eres admin)."""
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await service.delete_post(db, post_id, user)
    await db.commit()
    return {"deleted": True}
