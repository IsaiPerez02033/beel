"""Lógica de negocio para historias de anfitriones."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.stories.models import Story, StoryView
from app.modules.users.models import User

logger = logging.getLogger(__name__)

STORY_TTL = timedelta(hours=24)
MAX_ACTIVE_PER_HOST = 5


def _active_filter(now: datetime):
    return (Story.expires_at > now, Story.deleted_at.is_(None))


async def create_story(
    db: AsyncSession,
    host: User,
    media_url: str,
    storage_key: Optional[str],
    caption: Optional[str],
    property_id: Optional[uuid.UUID],
) -> Story:
    now = datetime.now(timezone.utc)

    active = (
        await db.execute(
            select(func.count()).select_from(Story).where(
                Story.host_id == host.id, *_active_filter(now)
            )
        )
    ).scalar_one()
    if active >= MAX_ACTIVE_PER_HOST:
        raise HTTPException(
            status_code=400,
            detail=f"Solo puedes tener {MAX_ACTIVE_PER_HOST} historias activas a la vez.",
        )

    story = Story(
        host_id=host.id,
        property_id=property_id,
        media_url=media_url,
        storage_key=storage_key,
        media_type="image",
        caption=caption,
        expires_at=now + STORY_TTL,
    )
    db.add(story)
    await db.flush()
    logger.info("Historia %s creada por anfitrión %s", story.id, host.id)
    return story


async def get_feed(
    db: AsyncSession, viewer_id: Optional[uuid.UUID]
) -> list[dict]:
    """Historias activas agrupadas por anfitrión, no-vistas primero."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story)
        .where(*_active_filter(now))
        .order_by(Story.created_at.asc())
    )
    stories = list(result.scalars().all())
    if not stories:
        return []

    seen_ids: set[uuid.UUID] = set()
    if viewer_id:
        seen_result = await db.execute(
            select(StoryView.story_id).where(
                StoryView.viewer_id == viewer_id,
                StoryView.story_id.in_([s.id for s in stories]),
            )
        )
        seen_ids = {row[0] for row in seen_result.all()}

    groups: dict[uuid.UUID, dict] = {}
    for s in stories:
        g = groups.setdefault(s.host_id, {"host": s.host, "stories": [], "all_seen": True})
        seen = s.id in seen_ids
        g["stories"].append({**_story_dict(s), "seen": seen})
        if not seen:
            g["all_seen"] = False

    # No-vistas primero; dentro de cada bloque, la más reciente primero.
    ordered = sorted(
        groups.values(),
        key=lambda g: (g["all_seen"], -max(st["created_at"].timestamp() for st in g["stories"])),
    )
    return ordered


def _story_dict(s: Story) -> dict:
    return {
        "id": s.id,
        "host_id": s.host_id,
        "property_id": s.property_id,
        "media_url": s.media_url,
        "media_type": s.media_type,
        "caption": s.caption,
        "created_at": s.created_at,
        "expires_at": s.expires_at,
    }


async def mark_viewed(db: AsyncSession, story_id: uuid.UUID, viewer_id: uuid.UUID) -> None:
    now = datetime.now(timezone.utc)
    story = (
        await db.execute(select(Story).where(Story.id == story_id, *_active_filter(now)))
    ).scalar_one_or_none()
    if not story:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    existing = (
        await db.execute(
            select(StoryView).where(
                StoryView.story_id == story_id, StoryView.viewer_id == viewer_id
            )
        )
    ).scalar_one_or_none()
    if not existing:
        db.add(StoryView(story_id=story_id, viewer_id=viewer_id))
        await db.flush()


async def delete_story(db: AsyncSession, story_id: uuid.UUID, user: User) -> None:
    story = (
        await db.execute(select(Story).where(Story.id == story_id))
    ).scalar_one_or_none()
    if not story or story.deleted_at:
        raise HTTPException(status_code=404, detail="Historia no encontrada")
    if story.host_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias historias")
    story.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def my_stories(db: AsyncSession, host_id: uuid.UUID) -> list[dict]:
    """Historias activas propias con conteo de vistas."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story, func.count(StoryView.viewer_id))
        .outerjoin(StoryView, StoryView.story_id == Story.id)
        .where(Story.host_id == host_id, *_active_filter(now))
        .group_by(Story.id)
        .order_by(Story.created_at.asc())
    )
    return [
        {**_story_dict(s), "seen": True, "view_count": int(count)}
        for s, count in result.all()
    ]


async def cleanup_expired_stories(db: AsyncSession) -> int:
    """Borra del storage las historias expiradas hace >7 días. Devuelve cuántas."""
    from app.core.storage import delete_photo

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    result = await db.execute(
        select(Story).where(Story.expires_at < cutoff, Story.deleted_at.is_(None)).limit(100)
    )
    old = list(result.scalars().all())
    cleaned = 0
    for s in old:
        try:
            if s.storage_key:
                await delete_photo(s.storage_key)
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudo borrar media de historia %s: %s", s.id, e)
        s.deleted_at = datetime.now(timezone.utc)
        cleaned += 1
    if cleaned:
        await db.flush()
    return cleaned
