"""Lógica de negocio para propiedades."""

import math
import uuid
import logging
import random
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.cache import get_cached, set_cached, invalidate, property_key, search_key
from app.modules.properties.models import Property, Amenity, PropertyAmenity, PropertyPhoto
from app.modules.properties.schemas import PropertyCreateIn, PropertyUpdateIn, SearchResultOut
from app.modules.users.models import User

logger = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _obfuscate_coords(
    lat: Decimal, lng: Decimal, radius_m: int = None
) -> tuple[Decimal, Decimal]:
    """
    Ofusca las coordenadas exactas desplazándolas aleatoriamente
    dentro del radio configurado. Usado en listings públicos.
    """
    if radius_m is None:
        radius_m = settings.LOCATION_OBFUSCATION_RADIUS_METERS

    # Convertir radio a grados (aprox)
    lat_deg = radius_m / 111_000
    lng_deg = radius_m / (111_000 * math.cos(math.radians(float(lat))))

    offset_lat = random.uniform(-lat_deg, lat_deg)
    offset_lng = random.uniform(-lng_deg, lng_deg)

    return (
        round(Decimal(str(float(lat) + offset_lat)), 5),
        round(Decimal(str(float(lng) + offset_lng)), 5),
    )


def _base_query():
    """Query base con eager loading de relaciones frecuentes."""
    return (
        select(Property)
        .options(
            selectinload(Property.host),
            selectinload(Property.photos),
            selectinload(Property.amenities).selectinload(PropertyAmenity.amenity),
        )
        .where(Property.deleted_at.is_(None))
    )


# ── Lectura ───────────────────────────────────────────────────────────────────

async def get_property(
    db: AsyncSession, property_id: uuid.UUID
) -> Optional[Property]:
    """Retorna una propiedad por ID (con cache)."""
    cache_key = property_key(str(property_id))
    cached = await get_cached(cache_key)
    if cached:
        # Retornamos el ORM object desde BD para consistencia
        # (cache se usa en serialización, no en ORM)
        pass

    result = await db.execute(
        _base_query().where(Property.id == property_id)
    )
    return result.scalar_one_or_none()


async def search_properties(
    db: AsyncSession,
    *,
    destino: Optional[str] = None,
    check_in: Optional[date] = None,
    check_out: Optional[date] = None,
    huespedes: Optional[int] = None,
    tipo: Optional[str] = None,
    precio_min: Optional[Decimal] = None,
    precio_max: Optional[Decimal] = None,
    mascotas: bool = False,
    instant_booking: bool = False,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radio_km: float = 10.0,
    page: int = 1,
    per_page: int = 20,
    status: str = "active",
) -> SearchResultOut:
    """Búsqueda de propiedades con filtros."""

    query = _base_query().where(Property.status == status)

    # ── Filtros DUROS (excluyen resultados) ───────────────────────────────────

    # Destino: SOLO ciudad o estado — nunca título ni dirección.
    # Si el usuario busca "Mérida", solo aparecen propiedades de Mérida.
    if destino:
        search_term = f"%{destino}%"
        query = query.where(
            or_(
                Property.city.ilike(search_term),
                Property.state.ilike(search_term),
            )
        )

    # Tipo de propiedad (filtro exacto)
    if tipo:
        query = query.where(Property.property_type == tipo)

    # Precio (filtro exacto)
    if precio_min is not None:
        query = query.where(Property.price_per_night >= precio_min)
    if precio_max is not None:
        query = query.where(Property.price_per_night <= precio_max)

    # Mascotas e instant booking (si el usuario los activa explícitamente)
    if mascotas:
        query = query.where(Property.allows_pets.is_(True))
    if instant_booking:
        query = query.where(Property.instant_booking.is_(True))

    # Proximidad geográfica
    if lat is not None and lng is not None:
        distance_filter = text(
            "earth_distance(ll_to_earth(latitude, longitude), "
            "ll_to_earth(:lat, :lng)) <= :radius"
        ).bindparams(lat=lat, lng=lng, radius=radio_km * 1000)
        query = query.where(distance_filter)

    # ── Huéspedes y fechas: duros sin destino, soft con destino ──────────────
    #
    # CON destino:  se muestran todas las propiedades de esa ciudad, ordenadas
    #               por cuántas cosas cumplen (primero las que tienen capacidad
    #               Y están disponibles, luego las demás).
    #
    # SIN destino:  el usuario busca algo específico (ej. "5 personas" o
    #               "del 15 al 20 de julio") → filtro duro para mostrar
    #               solo lo que realmente cumple.

    relevance_cases = []

    if huespedes:
        if destino:
            # Con destino: es ranking (+3 si cumple)
            relevance_cases.append(
                case((Property.max_guests >= huespedes, 3), else_=0)
            )
        else:
            # Sin destino: filtro duro
            query = query.where(Property.max_guests >= huespedes)

    if check_in and check_out:
        from sqlalchemy import not_, exists
        overlap_sq = (
            select(text("1"))
            .select_from(text("reservations r"))
            .where(
                and_(
                    text("r.property_id = properties.id"),
                    text("r.status = ANY(:statuses)"),
                    text("r.check_in < :check_out"),
                    text("r.check_out > :check_in"),
                )
            )
            .params(
                statuses=["confirmed", "pending"],
                check_out=check_out,
                check_in=check_in,
            )
        )
        if destino:
            # Con destino: es ranking (+2 si está disponible)
            relevance_cases.append(
                case((not_(exists(overlap_sq)), 2), else_=0)
            )
        else:
            # Sin destino: filtro duro
            query = query.where(not_(exists(overlap_sq)))

    # Orden: relevancia DESC → ranking_score → fecha
    if relevance_cases:
        relevance_expr = sum(relevance_cases[1:], relevance_cases[0])
        query = query.order_by(
            relevance_expr.desc(),
            Property.ranking_score.desc(),
            Property.created_at.desc(),
        )
    else:
        query = query.order_by(Property.ranking_score.desc(), Property.created_at.desc())

    # Contar total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginar
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    properties = list(result.scalars().all())

    return SearchResultOut(
        properties=properties,  # type: ignore[arg-type]  — Pydantic convertirá vía from_attributes
        total=total,
        page=page,
        per_page=per_page,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


# ── Escritura ─────────────────────────────────────────────────────────────────

async def create_property(
    db: AsyncSession, host: User, data: PropertyCreateIn
) -> Property:
    """Crea una nueva propiedad en estado pending_review."""
    import random

    # Generar coordenadas aproximadas para el mapa público
    lat_approx, lng_approx = _obfuscate_coords(data.latitude, data.longitude)

    property_ = Property(
        host_id=host.id,
        title=data.title,
        description=data.description,
        property_type=data.property_type,
        status="pending_review",
        address=data.address,
        neighborhood=data.neighborhood,
        city=data.city,
        state=data.state,
        country=data.country,
        postal_code=data.postal_code,
        latitude=data.latitude,
        longitude=data.longitude,
        latitude_approx=lat_approx,
        longitude_approx=lng_approx,
        max_guests=data.max_guests,
        bedrooms=data.bedrooms,
        beds=data.beds,
        bathrooms=data.bathrooms,
        price_per_night=data.price_per_night,
        cleaning_fee=data.cleaning_fee,
        security_deposit=data.security_deposit,
        min_stay_nights=data.min_stay_nights,
        max_stay_nights=data.max_stay_nights,
        cancellation_policy=data.cancellation_policy,
        check_in_time=data.check_in_time,
        check_out_time=data.check_out_time,
        instant_booking=data.instant_booking,
        allows_pets=data.allows_pets,
        allows_smoking=data.allows_smoking,
        allows_events=data.allows_events,
    )
    db.add(property_)
    await db.flush()

    # Asociar amenidades
    if data.amenity_ids:
        for amenity_id in data.amenity_ids:
            pa = PropertyAmenity(
                property_id=property_.id,
                amenity_id=amenity_id,
            )
            db.add(pa)

    # Actualizar contador del host
    current_listings = host.total_listings or 0
    host.total_listings = current_listings + 1
    await db.flush()

    logger.info("Propiedad creada: %s por host %s", property_.id, host.id)
    # Re-consultar con relaciones (host/photos/amenities) cargadas para que la
    # serialización del response_model no dispare un lazy-load fuera del greenlet.
    return await get_property(db, property_.id)


async def update_property(
    db: AsyncSession, property_: Property, data: PropertyUpdateIn
) -> Property:
    """Actualiza campos de una propiedad. Solo permite modificar campos seguros."""
    update_data = data.model_dump(exclude_unset=True)
    # Lista blanca: solo estos campos pueden modificarse
    allowed = {
        "title", "description", "address", "neighborhood", "city", "state",
        "property_type", "max_guests", "bedrooms", "beds", "bathrooms",
        "price_per_night", "cleaning_fee", "security_deposit",
        "min_stay_nights", "max_stay_nights", "cancellation_policy",
        "check_in_time", "check_out_time", "instant_booking",
        "allows_pets", "allows_smoking", "allows_events",
        "require_guest_identity",
    }
    prop_id = property_.id
    for field, value in update_data.items():
        if field in allowed:
            setattr(property_, field, value)
    await db.commit()
    await invalidate(property_key(str(prop_id)))
    # Re-consultar con relaciones cargadas: el commit expira el objeto y la
    # serialización del response_model dispararía un lazy-load fuera del greenlet.
    return await get_property(db, prop_id)


async def delete_property(db: AsyncSession, property_: Property) -> None:
    """Soft-delete de la propiedad. Decrementa el contador del DUEÑO real
    (no del actor) para que un admin pueda borrar sin afectar su propio conteo."""
    property_.deleted_at = datetime.now(timezone.utc)
    property_.status = "deleted"
    if property_.host:
        current_listings = property_.host.total_listings or 0
        property_.host.total_listings = max(0, current_listings - 1)
    await db.commit()
    await invalidate(property_key(str(property_.id)))


# ── Amenidades ────────────────────────────────────────────────────────────────

async def list_amenities(db: AsyncSession) -> list[Amenity]:
    """Lista todas las amenidades disponibles."""
    result = await db.execute(
        select(Amenity).order_by(Amenity.sort_order, Amenity.name_es)
    )
    return list(result.scalars().all())


# ── Moderación (admin) ──────────────────────────────────────────────────────────

async def list_for_review(
    db: AsyncSession, status_filter: str = "pending_review", limit: int = 100
) -> list[Property]:
    """Lista propiedades por estado, para la cola de moderación del admin."""
    result = await db.execute(
        _base_query()
        .where(Property.status == status_filter)
        .order_by(Property.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def set_moderation_status(
    db: AsyncSession,
    property_: Property,
    new_status: str,
    admin_id: uuid.UUID,
    reason: Optional[str] = None,
) -> Property:
    """Aprueba (active) o rechaza (suspended) una propiedad."""
    prop_id = property_.id
    property_.status = new_status
    if new_status == "active":
        property_.approved_by = admin_id
        property_.approved_at = datetime.now(timezone.utc)
        property_.suspension_reason = None
    elif reason is not None:
        property_.suspension_reason = reason
    await db.commit()
    await invalidate(property_key(str(prop_id)))
    # Re-consultar con relaciones cargadas: el commit expira el objeto y la
    # serialización del response_model dispararía un lazy-load fuera del greenlet.
    return await get_property(db, prop_id)
