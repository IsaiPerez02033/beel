"""Lógica de negocio para experiencias."""

import math
import uuid
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.properties.service import _obfuscate_coords
from app.modules.experiences.models import Experience
from app.modules.experiences.schemas import (
    ExperienceCreateIn, ExperienceUpdateIn, ExperienceListOut,
)
from app.modules.users.models import User

logger = logging.getLogger(__name__)


def _base_query():
    return (
        select(Experience)
        .options(
            selectinload(Experience.host),
            selectinload(Experience.photos),
        )
        .where(Experience.deleted_at.is_(None))
    )


async def get_experience(db: AsyncSession, experience_id: uuid.UUID) -> Optional[Experience]:
    result = await db.execute(_base_query().where(Experience.id == experience_id))
    return result.scalar_one_or_none()


async def search_experiences(
    db: AsyncSession,
    *,
    destino: Optional[str] = None,
    categoria: Optional[str] = None,
    precio_min: Optional[Decimal] = None,
    precio_max: Optional[Decimal] = None,
    page: int = 1,
    per_page: int = 20,
    status: str = "active",
) -> ExperienceListOut:
    query = _base_query()
    if status:
        query = query.where(Experience.status == status)
    if categoria:
        query = query.where(Experience.category == categoria)
    if destino:
        like = f"%{destino}%"
        query = query.where(or_(Experience.city.ilike(like), Experience.state.ilike(like)))
    if precio_min is not None:
        query = query.where(Experience.price_per_person >= precio_min)
    if precio_max is not None:
        query = query.where(Experience.price_per_person <= precio_max)

    query = query.order_by(Experience.ranking_score.desc(), Experience.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    experiences = list(result.scalars().all())

    return ExperienceListOut(
        experiences=experiences,  # type: ignore[arg-type]
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


async def create_experience(db: AsyncSession, host: User, data: ExperienceCreateIn) -> Experience:
    lat_approx, lng_approx = _obfuscate_coords(data.latitude, data.longitude)
    exp = Experience(
        host_id=host.id,
        title=data.title,
        description=data.description,
        category=data.category,
        status="pending_review",
        address=data.address,
        neighborhood=data.neighborhood,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        latitude=data.latitude,
        longitude=data.longitude,
        latitude_approx=lat_approx,
        longitude_approx=lng_approx,
        price_per_person=data.price_per_person,
        duration_minutes=data.duration_minutes,
        min_participants=data.min_participants,
        max_participants=data.max_participants,
        languages=data.languages,
        included=data.included,
        requirements=data.requirements,
        instant_booking=data.instant_booking,
        cancellation_policy=data.cancellation_policy,
    )
    db.add(exp)
    await db.flush()
    await db.refresh(exp)
    logger.info("Experiencia creada: %s por host %s", exp.id, host.id)
    return await get_experience(db, exp.id)


async def update_experience(db: AsyncSession, exp: Experience, data: ExperienceUpdateIn) -> Experience:
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(exp, field, value)
    await db.flush()
    await db.refresh(exp)
    return await get_experience(db, exp.id)


async def delete_experience(db: AsyncSession, exp: Experience) -> None:
    exp.deleted_at = datetime.now(timezone.utc)
    exp.status = "deleted"
    await db.flush()


async def set_moderation_status(
    db: AsyncSession, exp: Experience, new_status: str, admin_id: uuid.UUID,
    reason: Optional[str] = None,
) -> Experience:
    exp.status = new_status
    if new_status == "active":
        exp.approved_by = admin_id
        exp.approved_at = datetime.now(timezone.utc)
    if new_status == "suspended" and reason:
        exp.suspension_reason = reason
    await db.flush()
    await db.refresh(exp)
    return await get_experience(db, exp.id)


async def list_pending(db: AsyncSession) -> list[Experience]:
    result = await db.execute(
        _base_query().where(Experience.status == "pending_review").order_by(Experience.created_at.asc())
    )
    return list(result.scalars().all())


async def list_by_host(db: AsyncSession, host_id: uuid.UUID) -> list[Experience]:
    result = await db.execute(
        _base_query().where(Experience.host_id == host_id).order_by(Experience.created_at.desc())
    )
    return list(result.scalars().all())
