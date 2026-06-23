"""
Lógica compartida para sembrar/borrar propiedades de ejemplo.

La usan tanto el script CLI (scripts/seed_demo.py) como el endpoint admin
(/properties/admin/seed-demo). Todas las propiedades demo pertenecen a un
único usuario (DEMO_HOST_EMAIL), por lo que se pueden borrar de golpe sin
afectar a usuarios reales.
"""

from datetime import datetime, time, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import User
from app.modules.properties.models import (
    Property, PropertyPhoto, Amenity, PropertyAmenity,
)

# Marca para identificar todo lo demo.
DEMO_HOST_EMAIL = "demo@beel.mx"

BASE_AMENITIES = [
    ("wifi", "WiFi", "basicos", "📶", True),
    ("aire_acondicionado", "Aire acondicionado", "basicos", "❄️", True),
    ("cocina", "Cocina equipada", "cocina", "🍳", True),
    ("piscina", "Alberca", "exteriores", "🏊", True),
    ("estacionamiento", "Estacionamiento", "basicos", "🚗", False),
    ("lavadora", "Lavadora", "basicos", "🫧", False),
    ("terraza", "Terraza", "exteriores", "🌿", False),
    ("tv", "TV", "basicos", "📺", False),
    ("calefaccion", "Calefacción", "basicos", "🔥", False),
    ("mascotas_ok", "Apto para mascotas", "reglas", "🐾", False),
]

DEMOS = [
    {
        "title": "Departamento moderno en la Roma Norte",
        "property_type": "departamento",
        "description": "Luminoso departamento en una de las colonias más vibrantes de la CDMX. A pasos de cafés, galerías y el metro. Cocina equipada, WiFi rápido y terraza privada. Perfecto para una escapada urbana.",
        "address": "Calle Orizaba 100, Depto 5", "neighborhood": "Roma Norte",
        "city": "Ciudad de México", "state": "CDMX",
        "lat": Decimal("19.41850"), "lng": Decimal("-99.16200"),
        "max_guests": 4, "bedrooms": 2, "beds": 2, "bathrooms": Decimal("1.0"),
        "price_per_night": Decimal("1650"), "cleaning_fee": Decimal("250"),
        "min_stay_nights": 2, "cancellation_policy": "moderada",
        "instant_booking": True, "allows_pets": True, "allows_smoking": False,
        "total_reviews": 31, "avg_rating": Decimal("4.85"), "total_bookings": 84,
        "amenities": ["wifi", "aire_acondicionado", "cocina", "terraza", "tv", "mascotas_ok"],
        "photos": [
            "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200",
            "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200",
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200",
        ],
    },
    {
        "title": "Casa colonial con patio en el centro de Mérida",
        "property_type": "casa",
        "description": "Hermosa casa colonial restaurada a 5 minutos del Paseo de Montejo. Patio interior con alberca, cocina equipada y 3 recámaras con aire acondicionado. Ideal para familias.",
        "address": "Calle 62 #457 entre 53 y 55", "neighborhood": "Centro Histórico",
        "city": "Mérida", "state": "Yucatán",
        "lat": Decimal("20.96700"), "lng": Decimal("-89.62370"),
        "max_guests": 6, "bedrooms": 3, "beds": 4, "bathrooms": Decimal("2.0"),
        "price_per_night": Decimal("1800"), "cleaning_fee": Decimal("300"),
        "min_stay_nights": 2, "cancellation_policy": "flexible",
        "instant_booking": True, "allows_pets": True, "allows_smoking": False,
        "total_reviews": 24, "avg_rating": Decimal("4.80"), "total_bookings": 67,
        "amenities": ["wifi", "aire_acondicionado", "cocina", "piscina", "estacionamiento", "terraza"],
        "photos": [
            "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200",
            "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=1200",
        ],
    },
    {
        "title": "Villa frente al mar en Playa del Carmen",
        "property_type": "villa",
        "description": "Villa de lujo a una cuadra de la playa y la Quinta Avenida. Alberca privada, 4 recámaras y terraza con vista. La opción perfecta para un grupo grande en el Caribe mexicano.",
        "address": "Av. 10 Norte entre Calle 24 y 26", "neighborhood": "Centro",
        "city": "Playa del Carmen", "state": "Quintana Roo",
        "lat": Decimal("20.62960"), "lng": Decimal("-87.07390"),
        "max_guests": 8, "bedrooms": 4, "beds": 5, "bathrooms": Decimal("3.0"),
        "price_per_night": Decimal("4200"), "cleaning_fee": Decimal("600"),
        "min_stay_nights": 3, "cancellation_policy": "estricta",
        "instant_booking": False, "allows_pets": False, "allows_smoking": False,
        "total_reviews": 48, "avg_rating": Decimal("4.91"), "total_bookings": 120,
        "amenities": ["wifi", "aire_acondicionado", "cocina", "piscina", "estacionamiento", "terraza", "tv"],
        "photos": [
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200",
            "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200",
        ],
    },
    {
        "title": "Loft de diseño en el centro de Guadalajara",
        "property_type": "departamento",
        "description": "Loft de estilo industrial en la colonia Americana, la zona más cool de Guadalajara. Cerca de los mejores bares y restaurantes. WiFi de alta velocidad, ideal para nómadas digitales.",
        "address": "Av. Chapultepec 480", "neighborhood": "Colonia Americana",
        "city": "Guadalajara", "state": "Jalisco",
        "lat": Decimal("20.67670"), "lng": Decimal("-103.36840"),
        "max_guests": 2, "bedrooms": 1, "beds": 1, "bathrooms": Decimal("1.0"),
        "price_per_night": Decimal("1200"), "cleaning_fee": Decimal("200"),
        "min_stay_nights": 1, "cancellation_policy": "flexible",
        "instant_booking": True, "allows_pets": False, "allows_smoking": False,
        "total_reviews": 19, "avg_rating": Decimal("4.78"), "total_bookings": 53,
        "amenities": ["wifi", "aire_acondicionado", "cocina", "tv", "lavadora"],
        "photos": [
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200",
            "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=1200",
            "https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=1200",
        ],
    },
    {
        "title": "Cabaña rústica en San Cristóbal de las Casas",
        "property_type": "cabaña",
        "description": "Acogedora cabaña de madera rodeada de bosque, a 10 minutos del centro de San Cristóbal. Chimenea, vistas a la montaña y mucha tranquilidad. Perfecta para desconectarte.",
        "address": "Camino al Cerro 12, Barrio del Cerrillo", "neighborhood": "El Cerrillo",
        "city": "San Cristóbal de las Casas", "state": "Chiapas",
        "lat": Decimal("16.73700"), "lng": Decimal("-92.63760"),
        "max_guests": 4, "bedrooms": 2, "beds": 2, "bathrooms": Decimal("1.0"),
        "price_per_night": Decimal("950"), "cleaning_fee": Decimal("150"),
        "min_stay_nights": 2, "cancellation_policy": "moderada",
        "instant_booking": True, "allows_pets": True, "allows_smoking": False,
        "total_reviews": 27, "avg_rating": Decimal("4.88"), "total_bookings": 61,
        "amenities": ["wifi", "cocina", "calefaccion", "estacionamiento", "mascotas_ok"],
        "photos": [
            "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=1200",
            "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1200",
            "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=1200",
        ],
    },
    {
        "title": "Casa con alberca en San Miguel de Allende",
        "property_type": "casa",
        "description": "Elegante casa mexicana con alberca y terraza con vista a la Parroquia. Decoración artesanal, 3 recámaras y a pasos del Jardín Principal. Una joya en uno de los pueblos más bonitos de México.",
        "address": "Calle Recreo 38", "neighborhood": "Centro",
        "city": "San Miguel de Allende", "state": "Guanajuato",
        "lat": Decimal("20.91530"), "lng": Decimal("-100.74360"),
        "max_guests": 6, "bedrooms": 3, "beds": 3, "bathrooms": Decimal("2.5"),
        "price_per_night": Decimal("2600"), "cleaning_fee": Decimal("400"),
        "min_stay_nights": 2, "cancellation_policy": "moderada",
        "instant_booking": False, "allows_pets": False, "allows_smoking": False,
        "total_reviews": 36, "avg_rating": Decimal("4.93"), "total_bookings": 95,
        "amenities": ["wifi", "aire_acondicionado", "cocina", "piscina", "terraza", "estacionamiento"],
        "photos": [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200",
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200",
            "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200",
        ],
    },
]


async def _ensure_amenities(db: AsyncSession) -> dict[str, Amenity]:
    existing = {a.slug: a for a in (await db.execute(select(Amenity))).scalars().all()}
    for i, (slug, name_es, category, icon, highlight) in enumerate(BASE_AMENITIES):
        if slug not in existing:
            a = Amenity(slug=slug, name_es=name_es, category=category,
                        icon=icon, is_highlight=highlight, sort_order=i)
            db.add(a)
            existing[slug] = a
    await db.flush()
    return existing


async def _ensure_demo_host(db: AsyncSession) -> User:
    user = (await db.execute(
        select(User).where(User.email == DEMO_HOST_EMAIL)
    )).scalar_one_or_none()
    if user:
        return user
    user = User(
        email=DEMO_HOST_EMAIL, full_name="Anfitrión Demo Beel",
        provider="credentials", role="host",
        is_phone_verified=True, is_identity_verified=True,
        identity_status="approved",
        identity_verified_at=datetime.now(timezone.utc),
        phone_verified_at=datetime.now(timezone.utc),
        email_verified=True, host_since=datetime.now(timezone.utc),
        avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
    )
    db.add(user)
    await db.flush()
    return user


async def seed_demo_data(db: AsyncSession) -> dict:
    """Inserta las propiedades demo. Idempotente (omite las que ya existen)."""
    amenities = await _ensure_amenities(db)
    host = await _ensure_demo_host(db)

    existing_titles = {
        p.title for p in (await db.execute(
            select(Property).where(Property.host_id == host.id)
        )).scalars().all()
    }

    created: list[str] = []
    for d in DEMOS:
        if d["title"] in existing_titles:
            continue
        prop = Property(
            host_id=host.id, title=d["title"], description=d["description"],
            property_type=d["property_type"], status="active",
            address=d["address"], neighborhood=d["neighborhood"],
            city=d["city"], state=d["state"], country="México", country_code="MX",
            latitude=d["lat"], longitude=d["lng"],
            latitude_approx=d["lat"], longitude_approx=d["lng"],
            max_guests=d["max_guests"], bedrooms=d["bedrooms"], beds=d["beds"],
            bathrooms=d["bathrooms"], price_per_night=d["price_per_night"],
            currency="MXN", cleaning_fee=d["cleaning_fee"],
            min_stay_nights=d["min_stay_nights"],
            cancellation_policy=d["cancellation_policy"],
            check_in_time=time(15, 0), check_out_time=time(11, 0),
            instant_booking=d["instant_booking"], allows_pets=d["allows_pets"],
            allows_smoking=d["allows_smoking"], total_reviews=d["total_reviews"],
            avg_rating=d["avg_rating"], total_bookings=d["total_bookings"],
            approved_at=datetime.now(timezone.utc),
        )
        db.add(prop)
        await db.flush()
        for i, url in enumerate(d["photos"]):
            db.add(PropertyPhoto(property_id=prop.id, url=url,
                                 display_order=i, is_primary=(i == 0)))
        for slug in d["amenities"]:
            am = amenities.get(slug)
            if am:
                db.add(PropertyAmenity(property_id=prop.id, amenity_id=am.id))
        created.append(d["title"])

    await db.commit()
    return {"created": created, "skipped": len(DEMOS) - len(created),
            "host_email": DEMO_HOST_EMAIL}


async def delete_demo_data(db: AsyncSession, purge_host: bool = False) -> dict:
    """Borra TODAS las propiedades del usuario demo (y opcionalmente el usuario)."""
    host = (await db.execute(
        select(User).where(User.email == DEMO_HOST_EMAIL)
    )).scalar_one_or_none()
    if not host:
        return {"deleted": 0, "host_purged": False, "note": "No existe usuario demo"}

    props = (await db.execute(
        select(Property).where(Property.host_id == host.id)
    )).scalars().all()
    for p in props:
        await db.delete(p)  # photos y amenities tienen ON DELETE CASCADE

    host_purged = False
    if purge_host:
        await db.delete(host)
        host_purged = True

    await db.commit()
    return {"deleted": len(props), "host_purged": host_purged}
