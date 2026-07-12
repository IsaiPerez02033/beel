"""Router de historias de anfitriones."""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, OptionalUser
from app.core.database import get_db
from app.core.limiter import limiter
from app.modules.stories import service
from app.modules.stories.schemas import MyStoriesOut, StoryFeedOut, StoryOut
from app.modules.users import service as user_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=StoryFeedOut)
async def stories_feed(
    current_user: OptionalUser,
    db: AsyncSession = Depends(get_db),
):
    """Historias activas agrupadas por anfitrión (público; `seen` requiere sesión)."""
    groups = await service.get_feed(db, current_user.id if current_user else None)
    return {"groups": groups}


@router.get("/mine", response_model=MyStoriesOut)
async def my_stories(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Historias activas propias, con conteo de vistas."""
    return {"stories": await service.my_stories(db, current_user.id)}


@router.post("", response_model=StoryOut, status_code=201)
@limiter.limit("10/minute")
async def create_story(
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    property_id: Optional[uuid.UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Publica una historia (foto). Solo anfitriones; expira en 24 horas."""
    from app.core.storage import ALLOWED_CONTENT_TYPES, s3_configured
    from app.core.storage import upload_photo as storage_upload

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.is_host:
        raise HTTPException(status_code=403, detail="Solo los anfitriones pueden publicar historias")

    if property_id:
        from app.modules.properties.models import Property
        prop = await db.get(Property, property_id)
        if not prop or (prop.host_id != user.id and user.role != "admin"):
            raise HTTPException(status_code=400, detail="La propiedad no te pertenece")

    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento no está configurado.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")

    file_bytes = await file.read()
    try:
        url, storage_key = await storage_upload(
            file_bytes=file_bytes,
            content_type=content_type,
            prefix=f"stories/{user.id}",
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    caption_clean = (caption or "").strip()[:200] or None
    story = await service.create_story(
        db, user, url, storage_key, caption_clean, property_id
    )
    await db.commit()
    return story


@router.post("/{story_id}/view", status_code=200)
async def view_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Marca una historia como vista por el usuario."""
    await service.mark_viewed(db, story_id, current_user.id)
    await db.commit()
    return {"viewed": True}


@router.delete("/{story_id}", status_code=200)
async def delete_story(
    story_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Borra una historia propia (o cualquiera si eres admin)."""
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await service.delete_story(db, story_id, user)
    await db.commit()
    return {"deleted": True}
