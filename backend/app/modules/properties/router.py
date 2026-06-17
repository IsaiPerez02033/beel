"""Router de propiedades."""

import uuid
import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, OptionalUser, get_current_user
from app.core.database import get_db
from app.modules.properties import service
from app.modules.properties.schemas import (
    AmenityOut,
    PropertyCardOut,
    PropertyCreateIn,
    PropertyOut,
    PropertyUpdateIn,
    SearchResultOut,
)
from app.modules.users import service as user_service

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Búsqueda y listado ────────────────────────────────────────────────────────

@router.get("/search", response_model=SearchResultOut)
async def search_properties(
    destino: Optional[str] = Query(None, description="Ciudad, colonia o nombre"),
    check_in: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Fecha de llegada YYYY-MM-DD"),
    check_out: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="Fecha de salida YYYY-MM-DD"),
    huespedes: Optional[int] = Query(None, ge=1, le=30),
    tipo: Optional[str] = Query(None, description="Tipo de propiedad"),
    precio_min: Optional[Decimal] = Query(None, ge=0),
    precio_max: Optional[Decimal] = Query(None, ge=0),
    mascotas: bool = Query(False),
    instant_booking: bool = Query(False),
    lat: Optional[float] = Query(None, ge=-90, le=90),
    lng: Optional[float] = Query(None, ge=-180, le=180),
    radio_km: float = Query(10.0, ge=0.5, le=100),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Busca propiedades activas con filtros opcionales."""
    from datetime import date as DateType

    check_in_date = DateType.fromisoformat(check_in) if check_in else None
    check_out_date = DateType.fromisoformat(check_out) if check_out else None

    return await service.search_properties(
        db,
        destino=destino,
        check_in=check_in_date,
        check_out=check_out_date,
        huespedes=huespedes,
        tipo=tipo,
        precio_min=precio_min,
        precio_max=precio_max,
        mascotas=mascotas,
        instant_booking=instant_booking,
        lat=lat,
        lng=lng,
        radio_km=radio_km,
        page=page,
        per_page=per_page,
    )


@router.get("/amenities", response_model=list[AmenityOut])
async def list_amenities(db: AsyncSession = Depends(get_db)):
    """Lista todas las amenidades disponibles para filtros."""
    return await service.list_amenities(db)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el detalle completo de una propiedad."""
    property_ = await service.get_property(db, property_id)
    if not property_ or property_.status not in ("active", "pending_review"):
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    return property_


@router.post("", response_model=PropertyOut, status_code=status.HTTP_201_CREATED)
async def create_property(
    data: PropertyCreateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Crea una nueva propiedad. El usuario debe ser anfitrión."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.is_host:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Debes ser anfitrión para publicar una propiedad. "
                   "Ve a /users/me/become-host primero.",
        )
    return await service.create_property(db, user, data)


@router.patch("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: uuid.UUID,
    data: PropertyUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una propiedad. Solo el anfitrión propietario puede hacerlo."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    property_ = await service.get_property(db, property_id)
    if not property_:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    if property_.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta propiedad")

    return await service.update_property(db, property_, data)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_property(
    property_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Elimina (soft-delete) una propiedad."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    property_ = await service.get_property(db, property_id)
    if not property_:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")

    if property_.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso")

    await service.delete_property(db, property_, user)


# ── Propiedades del anfitrión autenticado ─────────────────────────────────────

@router.get("/host/my-listings", response_model=SearchResultOut)
async def my_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las propiedades del anfitrión autenticado (todos los estados)."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    from sqlalchemy import select
    from app.modules.properties.models import Property
    from sqlalchemy.orm import selectinload
    from app.modules.properties.models import PropertyAmenity

    query = (
        select(Property)
        .options(
            selectinload(Property.host),
            selectinload(Property.photos),
            selectinload(Property.amenities).selectinload(PropertyAmenity.amenity),
        )
        .where(Property.host_id == user.id, Property.deleted_at.is_(None))
        .order_by(Property.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    from sqlalchemy import func
    count_q = select(func.count()).where(
        Property.host_id == user.id, Property.deleted_at.is_(None)
    )
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(query)
    properties = list(result.scalars().all())

    import math
    return SearchResultOut(
        properties=properties,  # type: ignore[arg-type]
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )
