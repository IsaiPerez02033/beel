"""Datos iniciales: catálogo de amenidades

Revision ID: 006
Revises: 005
Create Date: 2024-01-01 00:05:00.000000

Incluye las amenidades más relevantes para el mercado mexicano/LATAM.
Para agregar nuevas amenidades en el futuro: nueva migración, nunca editar esta.
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None

AMENITIES = [
    # (slug, name_es, name_en, icon, category, is_highlight, sort_order)
    ("wifi",               "WiFi",                      "WiFi",                "Wifi",            "basicos",        True,  1),
    ("aire_acondicionado", "Aire acondicionado",         "Air conditioning",    "Wind",            "basicos",        True,  2),
    ("estacionamiento",    "Estacionamiento gratuito",   "Free parking",        "Car",             "basicos",        True,  3),
    ("alberca",            "Alberca",                    "Pool",                "Waves",           "basicos",        True,  4),
    ("televisor",          "Televisor",                  "TV",                  "Tv",              "basicos",        True,  5),
    ("lavadora",           "Lavadora",                   "Washing machine",     "Shirt",           "basicos",        False, 6),
    ("secadora",           "Secadora",                   "Dryer",               "Wind",            "basicos",        False, 7),
    ("cocina_equipada",    "Cocina equipada",             "Full kitchen",        "ChefHat",         "cocina",         True,  10),
    ("microondas",         "Microondas",                  "Microwave",           "Zap",             "cocina",         False, 11),
    ("cafetera",           "Cafetera",                    "Coffee maker",        "Coffee",          "cocina",         False, 12),
    ("refrigerador",       "Refrigerador",                "Refrigerator",        "Thermometer",     "cocina",         False, 13),
    ("utensilios",         "Utensilios de cocina",        "Cooking utensils",    "UtensilsCrossed", "cocina",         False, 14),
    ("toallas",            "Toallas",                     "Towels",              "Layers",          "bano",           False, 20),
    ("secador_pelo",       "Secador de pelo",              "Hair dryer",          "Wind",            "bano",           False, 21),
    ("articulos_bano",     "Artículos de baño",            "Toiletries",          "Droplets",        "bano",           False, 22),
    ("ropa_cama",          "Ropa de cama",                 "Bed linen",           "Bed",             "dormitorio",     False, 30),
    ("closet",             "Closet o armario",             "Closet",              "LayoutGrid",      "dormitorio",     False, 31),
    ("cuna",               "Cuna disponible",              "Crib available",      "Baby",            "dormitorio",     False, 32),
    ("terraza",            "Terraza o patio",              "Terrace or patio",    "TreePine",        "exterior",       False, 40),
    ("jardin",             "Jardín",                       "Garden",              "Flower",          "exterior",       False, 41),
    ("asador",             "Asador / BBQ",                 "BBQ grill",           "Flame",           "exterior",       False, 42),
    ("hamaca",             "Hamaca",                       "Hammock",             "Moon",            "exterior",       False, 43),
    ("caja_seguridad",     "Caja de seguridad",            "Safe box",            "Lock",            "seguridad",      False, 50),
    ("extinguidor",        "Extinguidor",                  "Fire extinguisher",   "Flame",           "seguridad",      False, 51),
    ("detector_humo",      "Detector de humo",             "Smoke detector",      "AlertTriangle",   "seguridad",      False, 52),
    ("botiquin",           "Botiquín de primeros auxilios","First aid kit",       "HeartPulse",      "seguridad",      False, 53),
    ("netflix",            "Netflix / Streaming",           "Netflix / Streaming", "Play",            "entretenimiento",False, 60),
    ("mesa_trabajo",       "Área de trabajo",               "Workspace",           "Monitor",         "entretenimiento",False, 61),
    ("acceso_silla_ruedas","Acceso para silla de ruedas",  "Wheelchair access",   "Accessibility",   "accesibilidad",  False, 70),
    ("sin_escaleras",      "Sin escaleras",                 "No stairs",           "ArrowDown",       "accesibilidad",  False, 71),
    ("desayuno",           "Desayuno incluido",             "Breakfast included",  "Coffee",          "servicios",      False, 80),
    ("servicio_limpieza",  "Servicio de limpieza",          "Cleaning service",    "Sparkles",        "servicios",      False, 81),
    ("recepcion_24h",      "Recepción 24 horas",            "24h check-in",        "Clock",           "servicios",      False, 82),
]


def upgrade() -> None:
    amenities_table = sa.table(
        "amenities",
        sa.column("slug", sa.String),
        sa.column("name_es", sa.String),
        sa.column("name_en", sa.String),
        sa.column("icon", sa.String),
        sa.column("category", sa.String),
        sa.column("is_highlight", sa.Boolean),
        sa.column("sort_order", sa.SmallInteger),
    )

    # Solo insertar si la tabla está vacía (idempotente)
    conn = op.get_bind()
    count = conn.execute(sa.text("SELECT COUNT(*) FROM amenities")).scalar()
    if count > 0:
        return

    op.bulk_insert(
        amenities_table,
        [
            {
                "slug": slug,
                "name_es": name_es,
                "name_en": name_en,
                "icon": icon,
                "category": category,
                "is_highlight": is_highlight,
                "sort_order": sort_order,
            }
            for slug, name_es, name_en, icon, category, is_highlight, sort_order
            in AMENITIES
        ],
    )


def downgrade() -> None:
    slugs = [a[0] for a in AMENITIES]
    op.execute(
        f"DELETE FROM amenities WHERE slug IN ({','.join(repr(s) for s in slugs)})"
    )
