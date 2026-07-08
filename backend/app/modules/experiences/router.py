"""Router de experiencias."""

import uuid
import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, OptionalUser
from app.core.database import get_db
from app.modules.experiences import service
from app.modules.experiences import booking_service
from app.modules.experiences.models import Experience, ExperiencePhoto
from app.modules.experiences.schemas import (
    ExperienceOut, ExperienceCardOut, ExperienceListOut,
    ExperienceCreateIn, ExperienceUpdateIn, ExperiencePhotoOut,
    ExperienceBookingOut, ExperienceBookingListOut, ExperienceBookingCreateIn,
    ExperienceBookingRespondIn, ExperienceBookingCancelIn, ExperiencePriceBreakdownOut,
)
from app.modules.users import service as user_service

logger = logging.getLogger(__name__)
router = APIRouter()


async def _require_admin(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Solo administradores")
    return user


# ── Admin ──────────────────────────────────────────────────────────────────────

@router.get("/admin/pending", response_model=list[ExperienceCardOut])
async def admin_pending(admin_user=Depends(_require_admin), db: AsyncSession = Depends(get_db)):
    return await service.list_pending(db)


@router.post("/{experience_id}/approve", response_model=ExperienceOut)
async def approve_experience(experience_id: uuid.UUID, admin_user=Depends(_require_admin), db: AsyncSession = Depends(get_db)):
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    return await service.set_moderation_status(db, exp, "active", admin_user.id)


@router.post("/{experience_id}/reject", response_model=ExperienceOut)
async def reject_experience(experience_id: uuid.UUID, admin_user=Depends(_require_admin), db: AsyncSession = Depends(get_db)):
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    return await service.set_moderation_status(db, exp, "suspended", admin_user.id, "Rechazada por el administrador")


# ── Búsqueda / lectura ─────────────────────────────────────────────────────────

@router.get("/search", response_model=ExperienceListOut)
async def search(
    destino: Optional[str] = None,
    categoria: Optional[str] = None,
    precio_min: Optional[Decimal] = None,
    precio_max: Optional[Decimal] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    status: str = "active",
    db: AsyncSession = Depends(get_db),
):
    return await service.search_experiences(
        db, destino=destino, categoria=categoria, precio_min=precio_min,
        precio_max=precio_max, page=page, per_page=per_page, status=status,
    )


@router.get("/host/my-experiences", response_model=list[ExperienceCardOut])
async def my_experiences(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    return await service.list_by_host(db, current_user.id)


@router.get("/{experience_id}", response_model=ExperienceOut)
async def get_one(experience_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    return exp


# ── Crear / editar ─────────────────────────────────────────────────────────────

@router.post("", response_model=ExperienceOut, status_code=status.HTTP_201_CREATED)
async def create(data: ExperienceCreateIn, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    from app.core.auth import require_full_verified
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    require_full_verified(user)
    if not user.is_host:
        user = await user_service.become_host(db, user)
    return await service.create_experience(db, user, data)


@router.patch("/{experience_id}", response_model=ExperienceOut)
async def update(experience_id: uuid.UUID, data: ExperienceUpdateIn, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    if exp.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta experiencia")
    return await service.update_experience(db, exp, data)


@router.delete("/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(experience_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    if exp.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    await service.delete_experience(db, exp)


# ── Reservas de experiencia (bookings) ──────────────────────────────────────────

@router.get("/bookings/price", response_model=ExperiencePriceBreakdownOut)
async def booking_price(
    experience_id: uuid.UUID, participants: int = Query(1, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await booking_service.get_price_breakdown(db, experience_id, participants)


@router.get("/bookings/mine", response_model=ExperienceBookingListOut)
async def my_bookings(
    current_user: CurrentUser, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    items, total = await booking_service.list_guest_bookings(db, current_user.id, status, page, per_page)
    return ExperienceBookingListOut(bookings=items, total=total, page=page, per_page=per_page)


@router.get("/bookings/host", response_model=ExperienceBookingListOut)
async def host_bookings(
    current_user: CurrentUser, status: Optional[str] = None,
    page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    items, total = await booking_service.list_host_bookings(db, current_user.id, status, page, per_page)
    return ExperienceBookingListOut(bookings=items, total=total, page=page, per_page=per_page)


@router.post("/bookings", response_model=ExperienceBookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    data: ExperienceBookingCreateIn, current_user: CurrentUser, db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    booking = await booking_service.create_booking(db, user, data)
    await db.commit()
    return booking


@router.get("/bookings/{booking_id}", response_model=ExperienceBookingOut)
async def get_booking(booking_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    booking = await booking_service.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    if current_user.id not in (booking.guest_id, booking.host_id):
        raise HTTPException(status_code=403, detail="Sin acceso")
    return booking


@router.post("/bookings/{booking_id}/respond", response_model=ExperienceBookingOut)
async def respond_booking(
    booking_id: uuid.UUID, data: ExperienceBookingRespondIn,
    current_user: CurrentUser, db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_id(db, current_user.id)
    booking = await booking_service.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    booking = await booking_service.respond_to_booking(db, booking, user, data)
    await db.commit()
    return booking


@router.post("/bookings/{booking_id}/cancel", response_model=ExperienceBookingOut)
async def cancel_booking(
    booking_id: uuid.UUID, data: ExperienceBookingCancelIn,
    current_user: CurrentUser, db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_id(db, current_user.id)
    booking = await booking_service.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    booking = await booking_service.cancel_booking(db, booking, user, data)
    await db.commit()
    return booking


# ── Fotos ──────────────────────────────────────────────────────────────────────

@router.post("/{experience_id}/photos", response_model=ExperiencePhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    experience_id: uuid.UUID,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    caption: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    from app.core.storage import upload_photo as s3_upload, s3_configured, ALLOWED_CONTENT_TYPES

    user = await user_service.get_user_by_id(db, current_user.id)
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    if exp.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso para subir fotos")
    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento de fotos no está configurado.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")

    count = (await db.execute(
        select(func.count()).where(ExperiencePhoto.experience_id == experience_id)
    )).scalar_one()
    if count >= 20:
        raise HTTPException(status_code=400, detail="Máximo 20 fotos por experiencia")

    file_bytes = await file.read()
    try:
        url, s3_key = await s3_upload(
            file_bytes=file_bytes, content_type=content_type,
            prefix=f"experiences/{experience_id}",
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    photo = ExperiencePhoto(
        experience_id=experience_id, url=url, s3_key=s3_key,
        display_order=count, is_primary=(count == 0), caption=caption,
    )
    db.add(photo)
    await db.flush()
    await db.commit()
    return photo


@router.patch("/{experience_id}/photos/{photo_id}", response_model=ExperiencePhotoOut)
async def update_photo(
    experience_id: uuid.UUID, photo_id: uuid.UUID, data: dict,
    current_user: CurrentUser, db: AsyncSession = Depends(get_db),
):
    user = await user_service.get_user_by_id(db, current_user.id)
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    if exp.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    result = await db.execute(
        select(ExperiencePhoto).where(
            ExperiencePhoto.id == photo_id, ExperiencePhoto.experience_id == experience_id
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    if data.get("is_primary"):
        # Quitar primary de las demás
        others = (await db.execute(
            select(ExperiencePhoto).where(ExperiencePhoto.experience_id == experience_id)
        )).scalars().all()
        for p in others:
            p.is_primary = (p.id == photo_id)
    if "caption" in data:
        photo.caption = data["caption"]
    if "display_order" in data:
        photo.display_order = data["display_order"]
    await db.flush()
    await db.commit()
    return photo


@router.delete("/{experience_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(experience_id: uuid.UUID, photo_id: uuid.UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    user = await user_service.get_user_by_id(db, current_user.id)
    exp = await service.get_experience(db, experience_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiencia no encontrada")
    if exp.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso")
    result = await db.execute(
        select(ExperiencePhoto).where(
            ExperiencePhoto.id == photo_id, ExperiencePhoto.experience_id == experience_id
        )
    )
    photo = result.scalar_one_or_none()
    if photo:
        await db.delete(photo)
        await db.flush()
