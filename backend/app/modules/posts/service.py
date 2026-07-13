"""Lógica de negocio para publicaciones de anfitriones (feed estilo Instagram)."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.posts.models import Post, PostLike, PostMedia
from app.modules.users.models import User

logger = logging.getLogger(__name__)

MAX_MEDIA_PER_POST = 5


async def create_post(
    db: AsyncSession,
    host: User,
    media_items: list[dict],
    caption: Optional[str],
    property_id: Optional[uuid.UUID],
) -> Post:
    """Crea la publicación con su media ya subida. `media_items` trae dicts con
    media_url, storage_key, media_type y opcionalmente width/height/duration_s."""
    if not media_items:
        raise HTTPException(status_code=400, detail="La publicación necesita al menos una foto")
    if len(media_items) > MAX_MEDIA_PER_POST:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo {MAX_MEDIA_PER_POST} archivos por publicación",
        )

    post = Post(host_id=host.id, property_id=property_id, caption=caption)
    db.add(post)
    await db.flush()

    for i, item in enumerate(media_items):
        db.add(
            PostMedia(
                post_id=post.id,
                position=i,
                media_url=item["media_url"],
                storage_key=item.get("storage_key"),
                media_type=item.get("media_type", "image"),
                width=item.get("width"),
                height=item.get("height"),
                duration_s=item.get("duration_s"),
            )
        )
    await db.flush()
    await db.refresh(post)
    logger.info("Publicación %s creada por anfitrión %s", post.id, host.id)
    return post


async def _like_counts(db: AsyncSession, post_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not post_ids:
        return {}
    result = await db.execute(
        select(PostLike.post_id, func.count(PostLike.user_id))
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    )
    return {row[0]: int(row[1]) for row in result.all()}


async def _liked_ids(
    db: AsyncSession, post_ids: list[uuid.UUID], user_id: Optional[uuid.UUID]
) -> set[uuid.UUID]:
    if not post_ids or not user_id:
        return set()
    result = await db.execute(
        select(PostLike.post_id).where(
            PostLike.user_id == user_id, PostLike.post_id.in_(post_ids)
        )
    )
    return {row[0] for row in result.all()}


def _post_dict(p: Post, like_count: int, liked: bool) -> dict:
    return {
        "id": p.id,
        "host": p.host,
        "property_id": p.property_id,
        "caption": p.caption,
        "created_at": p.created_at,
        "media": p.media,
        "like_count": like_count,
        "liked": liked,
    }


async def get_feed(
    db: AsyncSession,
    viewer_id: Optional[uuid.UUID],
    cursor: Optional[datetime],
    per_page: int,
) -> dict:
    """Feed público paginado por keyset (created_at descendente)."""
    query = select(Post).where(Post.deleted_at.is_(None))
    if cursor:
        query = query.where(Post.created_at < cursor)
    query = query.order_by(Post.created_at.desc()).limit(per_page)

    posts = list((await db.execute(query)).scalars().all())
    ids = [p.id for p in posts]
    counts = await _like_counts(db, ids)
    liked = await _liked_ids(db, ids, viewer_id)

    next_cursor = (
        posts[-1].created_at.isoformat() if len(posts) == per_page else None
    )
    return {
        "posts": [_post_dict(p, counts.get(p.id, 0), p.id in liked) for p in posts],
        "next_cursor": next_cursor,
    }


async def my_posts(db: AsyncSession, host_id: uuid.UUID) -> list[dict]:
    posts = list(
        (
            await db.execute(
                select(Post)
                .where(Post.host_id == host_id, Post.deleted_at.is_(None))
                .order_by(Post.created_at.desc())
            )
        ).scalars().all()
    )
    ids = [p.id for p in posts]
    counts = await _like_counts(db, ids)
    return [_post_dict(p, counts.get(p.id, 0), False) for p in posts]


async def _get_active_post(db: AsyncSession, post_id: uuid.UUID) -> Post:
    post = (
        await db.execute(select(Post).where(Post.id == post_id))
    ).scalar_one_or_none()
    if not post or post.deleted_at:
        raise HTTPException(status_code=404, detail="Publicación no encontrada")
    return post


async def like_post(
    db: AsyncSession, post_id: uuid.UUID, user_id: uuid.UUID, liked: bool
) -> dict:
    """Da o quita like (idempotente). Devuelve estado y conteo actualizado."""
    await _get_active_post(db, post_id)
    existing = (
        await db.execute(
            select(PostLike).where(
                PostLike.post_id == post_id, PostLike.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if liked and not existing:
        db.add(PostLike(post_id=post_id, user_id=user_id))
        await db.flush()
    elif not liked and existing:
        await db.delete(existing)
        await db.flush()
    counts = await _like_counts(db, [post_id])
    return {"liked": liked, "like_count": counts.get(post_id, 0)}


async def delete_post(db: AsyncSession, post_id: uuid.UUID, user: User) -> None:
    from app.core.storage import delete_photo

    post = await _get_active_post(db, post_id)
    if post.host_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo puedes borrar tus propias publicaciones")
    for m in post.media:
        try:
            if m.storage_key:
                await delete_photo(m.storage_key)
        except Exception as e:  # noqa: BLE001
            logger.warning("No se pudo borrar media de publicación %s: %s", post.id, e)
    post.deleted_at = datetime.now(timezone.utc)
    await db.flush()
