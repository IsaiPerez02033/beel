"""Router de propiedades."""

import uuid
import logging
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, OptionalUser
from app.core.database import get_db
from app.modules.properties import service
from app.modules.properties.schemas import (
    AmenityOut,
    PhotoUpdateIn,
    PropertyCardOut,
    PropertyCreateIn,
    PropertyOut,
    PropertyPhotoOut,
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
    from app.core.config import settings as s

    if s.DEMO_MODE or not s.has_database:
        return _demo_properties()

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
    from app.core.config import settings as s
    if s.DEMO_MODE or not s.has_database:
        demo = next((p for p in _demo_list if p["id"] == str(property_id)), None)
        if not demo:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")
        return demo

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
    """Crea una nueva propiedad. El usuario debe ser anfitrión y estar verificado."""
    from app.core.auth import require_verified

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    # Verificación obligatoria de teléfono e identidad. En Beel, estar
    # verificado ES el requisito para ser anfitrión, así que promovemos el
    # rol automáticamente si aún es "guest".
    require_verified(user)
    if not user.is_host:
        user = await user_service.become_host(db, user)
    return await service.create_property(db, user, data)


@router.patch("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: uuid.UUID,
    data: PropertyUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una propiedad. Solo el anfitrión propietario puede hacerlo."""
    user = await user_service.get_user_by_id(db, current_user.id)
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
    user = await user_service.get_user_by_id(db, current_user.id)
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
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Lista las propiedades del anfitrión autenticado (todos los estados)."""
    user = await user_service.get_user_by_id(db, current_user.id)
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


# ── Fotos ────────────────────────────────────────────────────────────────────

@router.post("/{property_id}/photos", response_model=PropertyPhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    property_id: uuid.UUID,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    caption: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Sube una foto para una propiedad a S3.
    Acepta: image/jpeg, image/png, image/webp. Máximo 10 MB.
    """
    from app.core.storage import upload_photo as s3_upload, s3_configured, ALLOWED_CONTENT_TYPES
    from app.modules.properties.models import PropertyPhoto
    from sqlalchemy import select, func

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    property_ = await service.get_property(db, property_id)
    if not property_:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    if property_.host_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permiso para subir fotos a esta propiedad")

    if not s3_configured():
        raise HTTPException(
            status_code=503,
            detail="El almacenamiento de fotos (S3) no está configurado. Contacta al administrador.",
        )

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")

    # Contar fotos existentes
    count = (await db.execute(
        select(func.count()).where(PropertyPhoto.property_id == property_id)
    )).scalar_one()
    if count >= 20:
        raise HTTPException(status_code=400, detail="Máximo 20 fotos por propiedad")

    file_bytes = await file.read()
    try:
        url, s3_key = await s3_upload(
            file_bytes=file_bytes,
            content_type=content_type,
            prefix=f"properties/{property_id}",
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    is_primary = count == 0  # Primera foto es la principal
    photo = PropertyPhoto(
        property_id=property_id,
        url=url,
        s3_key=s3_key,
        display_order=count,
        is_primary=is_primary,
        caption=caption,
    )
    db.add(photo)
    await db.flush()
    await db.commit()
    logger.info("Foto %s subida para propiedad %s", photo.id, property_id)
    return photo


@router.patch("/{property_id}/photos/{photo_id}", response_model=PropertyPhotoOut)
async def update_photo(
    property_id: uuid.UUID,
    photo_id: uuid.UUID,
    data: PhotoUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza caption, orden o estado primario de una foto."""
    from app.modules.properties.models import PropertyPhoto
    from sqlalchemy import select, update

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    property_ = await service.get_property(db, property_id)
    if not property_ or (property_.host_id != user.id and not user.is_admin):
        raise HTTPException(status_code=403, detail="Sin permiso")

    result = await db.execute(
        select(PropertyPhoto).where(
            PropertyPhoto.id == photo_id,
            PropertyPhoto.property_id == property_id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    if data.is_primary:
        # Quitar primary de las demás fotos
        await db.execute(
            update(PropertyPhoto)
            .where(PropertyPhoto.property_id == property_id)
            .values(is_primary=False)
        )
    if data.display_order is not None:
        photo.display_order = data.display_order
    if data.is_primary is not None:
        photo.is_primary = data.is_primary
    if data.caption is not None:
        photo.caption = data.caption

    await db.flush()
    await db.commit()
    return photo


@router.delete("/{property_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    property_id: uuid.UUID,
    photo_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Elimina una foto de la propiedad y de S3."""
    from app.core.storage import delete_photo as s3_delete
    from app.modules.properties.models import PropertyPhoto
    from sqlalchemy import select

    user = await user_service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    property_ = await service.get_property(db, property_id)
    if not property_ or (property_.host_id != user.id and not user.is_admin):
        raise HTTPException(status_code=403, detail="Sin permiso")

    result = await db.execute(
        select(PropertyPhoto).where(
            PropertyPhoto.id == photo_id,
            PropertyPhoto.property_id == property_id,
        )
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Foto no encontrada")

    s3_key = photo.s3_key
    await db.delete(photo)
    await db.commit()

    if s3_key:
        await s3_delete(s3_key)


# ── Demo data ──────────────────────────────────────────────────────────────────

_demo_list = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "title": "Casa Colonial en el Centro de Mérida",
        "description": "Hermosa casa colonial restaurada a 5 min del Paseo de Montejo. Patio interior con alberca, cocina equipada y 3 recámaras con aire acondicionado. Ideal para familias.",
        "property_type": "casa",
        "status": "active",
        "address": "Calle 62 #457 entre 53 y 55",
        "neighborhood": "Centro Histórico",
        "city": "Mérida",
        "state": "Yucatán",
        "latitude_approx": 20.9670,
        "longitude_approx": -89.6237,
        "max_guests": 6,
        "bedrooms": 3,
        "beds": 4,
        "bathrooms": 2,
        "price_per_night": 1800,
        "currency": "MXN",
        "cleaning_fee": 300,
        "min_stay_nights": 2,
        "cancellation_policy": "flexible",
        "instant_booking": True,
        "allows_pets": True,
        "allows_smoking": False,
        "allows_events": False,
        "total_reviews": 24,
        "avg_rating": 4.8,
        "total_bookings": 67,
        "host": {
            "id": "a0000000-0000-0000-0000-000000000001",
            "full_name": "María Gómez",
            "avatar_url": None,
            "is_identity_verified": True,
            "host_since": "2023-03-15",
            "total_listings": 3,
        },
        "photos": [
            {"id": "p1", "url": "https://images.unsplash.com/photo-1615571022219-eb45cf7faa36?w=600", "is_primary": True, "display_order": 1},
        ],
        "amenities": [
            {"amenity": {"id": "a1", "slug": "wifi", "name_es": "WiFi", "category": "basicos", "is_highlight": True, "icon": "📶"}},
            {"amenity": {"id": "a2", "slug": "piscina", "name_es": "Alberca", "category": "exteriores", "is_highlight": True, "icon": "🏊"}},
            {"amenity": {"id": "a3", "slug": "aire_acondicionado", "name_es": "Aire acondicionado", "category": "basicos", "is_highlight": True, "icon": "❄️"}},
            {"amenity": {"id": "a4", "slug": "cocina", "name_es": "Cocina equipada", "category": "cocina", "is_highlight": True, "icon": "🍳"}},
            {"amenity": {"id": "a5", "slug": "estacionamiento", "name_es": "Estacionamiento", "category": "basicos", "is_highlight": False, "icon": "🚗"}},
            {"amenity": {"id": "a6", "slug": "lavadora", "name_es": "Lavadora", "category": "basicos", "is_highlight": False, "icon": "🫧"}},
            {"amenity": {"id": "a7", "slug": "terraza", "name_es": "Terraza", "category": "exteriores", "is_highlight": False, "icon": "🌿"}},
        ],
        "created_at": "2024-01-10T12:00:00Z",
        "updated_at": "2025-06-01T08:30:00Z",
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "title": "Departamento Moderno cerca de Paseo Montejo",
        "description": "Amplio departamento con vista panorámica. Roof garden con jacuzzi, gym y estacionamiento subterráneo. A pasos de los mejores restaurantes de la ciudad.",
        "property_type": "departamento",
        "status": "active",
        "address": "Paseo de Montejo 512, Depto 7B",
        "neighborhood": "Zona Paseo Montejo",
        "city": "Mérida",
        "state": "Yucatán",
        "latitude_approx": 20.9825,
        "longitude_approx": -89.6180,
        "max_guests": 4,
        "bedrooms": 2,
        "beds": 2,
        "bathrooms": 1,
        "price_per_night": 1200,
        "currency": "MXN",
        "cleaning_fee": 200,
        "min_stay_nights": 1,
        "cancellation_policy": "moderada",
        "instant_booking": True,
        "allows_pets": False,
        "allows_smoking": False,
        "allows_events": False,
        "total_reviews": 12,
        "avg_rating": 4.6,
        "total_bookings": 34,
        "host": {
            "id": "a0000000-0000-0000-0000-000000000002",
            "full_name": "Carlos Rivera",
            "avatar_url": None,
            "is_identity_verified": True,
            "host_since": "2022-08-20",
            "total_listings": 5,
        },
        "photos": [
            {"id": "p2", "url": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600", "is_primary": True, "display_order": 1},
        ],
        "amenities": [
            {"amenity": {"id": "a1", "slug": "wifi", "name_es": "WiFi", "category": "basicos", "is_highlight": True, "icon": "📶"}},
            {"amenity": {"id": "a3", "slug": "aire_acondicionado", "name_es": "Aire acondicionado", "category": "basicos", "is_highlight": True, "icon": "❄️"}},
            {"amenity": {"id": "a5", "slug": "estacionamiento", "name_es": "Estacionamiento", "category": "basicos", "is_highlight": True, "icon": "🚗"}},
            {"amenity": {"id": "a8", "slug": "jacuzzi", "name_es": "Jacuzzi", "category": "exteriores", "is_highlight": True, "icon": "🛁"}},
            {"amenity": {"id": "a9", "slug": "gym", "name_es": "Gimnasio", "category": "basicos", "is_highlight": False, "icon": "💪"}},
        ],
        "created_at": "2024-03-22T14:00:00Z",
        "updated_at": "2025-05-15T10:00:00Z",
    },
    {
        "id": "00000000-0000-0000-0000-000000000003",
        "title": "Villa con Piscina en Chuburná",
        "description": "Espectacular villa con piscina privada, jardín tropical y palapa con hamacas. Perfecta para grupos grandes. A 15 min del centro y 25 de la playa.",
        "property_type": "villa",
        "status": "active",
        "address": "Calle 21 #128 x 16 y 18, Chuburná de Hidalgo",
        "neighborhood": "Chuburná",
        "city": "Mérida",
        "state": "Yucatán",
        "latitude_approx": 21.0150,
        "longitude_approx": -89.6300,
        "max_guests": 10,
        "bedrooms": 5,
        "beds": 7,
        "bathrooms": 4,
        "price_per_night": 3500,
        "currency": "MXN",
        "cleaning_fee": 500,
        "min_stay_nights": 3,
        "cancellation_policy": "estricta",
        "instant_booking": False,
        "allows_pets": True,
        "allows_smoking": True,
        "allows_events": True,
        "total_reviews": 8,
        "avg_rating": 4.9,
        "total_bookings": 22,
        "host": {
            "id": "a0000000-0000-0000-0000-000000000003",
            "full_name": "Ana Sofía Martínez",
            "avatar_url": None,
            "is_identity_verified": True,
            "host_since": "2024-01-05",
            "total_listings": 2,
        },
        "photos": [
            {"id": "p3", "url": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600", "is_primary": True, "display_order": 1},
        ],
        "amenities": [
            {"amenity": {"id": "a1", "slug": "wifi", "name_es": "WiFi", "category": "basicos", "is_highlight": True, "icon": "📶"}},
            {"amenity": {"id": "a2", "slug": "piscina", "name_es": "Alberca", "category": "exteriores", "is_highlight": True, "icon": "🏊"}},
            {"amenity": {"id": "a3", "slug": "aire_acondicionado", "name_es": "Aire acondicionado", "category": "basicos", "is_highlight": True, "icon": "❄️"}},
            {"amenity": {"id": "a4", "slug": "cocina", "name_es": "Cocina equipada", "category": "cocina", "is_highlight": True, "icon": "🍳"}},
            {"amenity": {"id": "a5", "slug": "estacionamiento", "name_es": "Estacionamiento", "category": "basicos", "is_highlight": True, "icon": "🚗"}},
            {"amenity": {"id": "a10", "slug": "parrilla", "name_es": "Parrilla", "category": "exteriores", "is_highlight": False, "icon": "🔥"}},
            {"amenity": {"id": "a6", "slug": "lavadora", "name_es": "Lavadora", "category": "basicos", "is_highlight": False, "icon": "🫧"}},
            {"amenity": {"id": "a7", "slug": "terraza", "name_es": "Terraza", "category": "exteriores", "is_highlight": False, "icon": "🌿"}},
            {"amenity": {"id": "a11", "slug": "mascotas", "name_es": "Pet-friendly", "category": "extras", "is_highlight": False, "icon": "🐾"}},
        ],
        "created_at": "2024-06-01T09:00:00Z",
        "updated_at": "2025-04-10T16:00:00Z",
    },
    {
        "id": "00000000-0000-0000-0000-000000000004",
        "title": "Cabaña Rústica en Dzityá",
        "description": "Acogedora cabaña rústica rodeada de naturaleza. Ideal para escapada romántica. Fogata al aire libre, hamaca, desayuno artesanal incluido.",
        "property_type": "cabaña",
        "status": "active",
        "address": "Km 12 Carretera Mérida-Progreso, Dzityá",
        "neighborhood": "Dzityá",
        "city": "Mérida",
        "state": "Yucatán",
        "latitude_approx": 21.0550,
        "longitude_approx": -89.6700,
        "max_guests": 2,
        "bedrooms": 1,
        "beds": 1,
        "bathrooms": 1,
        "price_per_night": 850,
        "currency": "MXN",
        "cleaning_fee": 150,
        "min_stay_nights": 1,
        "cancellation_policy": "flexible",
        "instant_booking": True,
        "allows_pets": False,
        "allows_smoking": True,
        "allows_events": False,
        "total_reviews": 18,
        "avg_rating": 4.7,
        "total_bookings": 45,
        "host": {
            "id": "a0000000-0000-0000-0000-000000000004",
            "full_name": "Jorge Ek Pech",
            "avatar_url": None,
            "is_identity_verified": True,
            "host_since": "2023-06-10",
            "total_listings": 1,
        },
        "photos": [
            {"id": "p4", "url": "https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=600", "is_primary": True, "display_order": 1},
        ],
        "amenities": [
            {"amenity": {"id": "a12", "slug": "desayuno", "name_es": "Desayuno incluido", "category": "extras", "is_highlight": True, "icon": "🍳"}},
            {"amenity": {"id": "a3", "slug": "aire_acondicionado", "name_es": "Aire acondicionado", "category": "basicos", "is_highlight": True, "icon": "❄️"}},
            {"amenity": {"id": "a1", "slug": "wifi", "name_es": "WiFi", "category": "basicos", "is_highlight": False, "icon": "📶"}},
            {"amenity": {"id": "a10", "slug": "parrilla", "name_es": "Parrilla", "category": "exteriores", "is_highlight": False, "icon": "🔥"}},
        ],
        "created_at": "2024-02-14T10:00:00Z",
        "updated_at": "2025-06-01T12:00:00Z",
    },
]


def _demo_properties():
    """Retorna datos mock cuando no hay base de datos."""
    import math
    return SearchResultOut(
        properties=_demo_list,  # type: ignore[arg-type]
        total=len(_demo_list),
        page=1,
        per_page=20,
        total_pages=1,
    )
