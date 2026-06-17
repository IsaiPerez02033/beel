"""Módulo de propiedades: listings, fotos, amenidades, reglas

Revision ID: 003
Revises: 002
Create Date: 2024-01-01 00:02:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tabla principal de propiedades
    op.create_table(
        "properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("host_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("property_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), server_default="pending_review",
                  nullable=False),
        # Ubicación
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("neighborhood", sa.String(255)),
        sa.Column("city", sa.String(100), nullable=False, server_default="Mérida"),
        sa.Column("state", sa.String(100), nullable=False, server_default="Yucatán"),
        sa.Column("country", sa.String(100), nullable=False, server_default="México"),
        sa.Column("country_code", sa.String(3), server_default="MX"),
        sa.Column("postal_code", sa.String(20)),
        sa.Column("latitude", sa.Numeric(10, 8), nullable=False),
        sa.Column("longitude", sa.Numeric(11, 8), nullable=False),
        sa.Column("latitude_approx", sa.Numeric(8, 5)),
        sa.Column("longitude_approx", sa.Numeric(8, 5)),
        # Capacidad
        sa.Column("max_guests", sa.SmallInteger, nullable=False),
        sa.Column("bedrooms", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("beds", sa.SmallInteger, nullable=False, server_default="1"),
        sa.Column("bathrooms", sa.Numeric(3, 1), nullable=False,
                  server_default="1.0"),
        # Precios
        sa.Column("price_per_night", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="MXN"),
        sa.Column("cleaning_fee", sa.Numeric(10, 2), server_default="0"),
        sa.Column("security_deposit", sa.Numeric(10, 2), server_default="0"),
        sa.Column("min_stay_nights", sa.SmallInteger, server_default="1"),
        sa.Column("max_stay_nights", sa.SmallInteger, server_default="30"),
        # Políticas
        sa.Column("cancellation_policy", sa.String(20), server_default="flexible"),
        sa.Column("check_in_time", sa.Time, server_default="15:00"),
        sa.Column("check_out_time", sa.Time, server_default="11:00"),
        sa.Column("instant_booking", sa.Boolean, server_default="FALSE"),
        sa.Column("allows_pets", sa.Boolean, server_default="FALSE"),
        sa.Column("allows_smoking", sa.Boolean, server_default="FALSE"),
        sa.Column("allows_events", sa.Boolean, server_default="FALSE"),
        # Métricas cacheadas
        sa.Column("total_reviews", sa.Integer, server_default="0"),
        sa.Column("avg_rating", sa.Numeric(3, 2)),
        sa.Column("avg_cleanliness", sa.Numeric(3, 2)),
        sa.Column("avg_communication", sa.Numeric(3, 2)),
        sa.Column("avg_location", sa.Numeric(3, 2)),
        sa.Column("avg_value", sa.Numeric(3, 2)),
        sa.Column("total_bookings", sa.Integer, server_default="0"),
        sa.Column("ranking_score", sa.Numeric(8, 4), server_default="0"),
        # Full-text search
        sa.Column("search_vector", TSVECTOR),
        # Administración
        sa.Column("approved_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("suspension_reason", sa.Text),
        # Soft delete y auditoría
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        # Constraints
        sa.CheckConstraint("max_guests > 0", name="chk_max_guests"),
        sa.CheckConstraint("price_per_night > 0", name="chk_price_positive"),
        sa.CheckConstraint(
            "property_type IN ('casa','departamento','cabaña','villa',"
            "'habitacion','hostal','otro')",
            name="chk_property_type"
        ),
        sa.CheckConstraint(
            "status IN ('pending_review','active','inactive','suspended','deleted')",
            name="chk_property_status"
        ),
        sa.CheckConstraint(
            "cancellation_policy IN ('flexible','moderate','strict')",
            name="chk_cancellation_policy"
        ),
    )

    # Índices de búsqueda
    op.create_index("idx_properties_host_id", "properties", ["host_id"])
    op.create_index("idx_properties_status", "properties", ["status"])
    op.create_index("idx_properties_city", "properties", ["city"])
    op.create_index("idx_properties_price", "properties", ["price_per_night"])
    op.create_index("idx_properties_ranking", "properties",
                    [sa.text("ranking_score DESC")])

    # Índice geoespacial
    op.execute("""
        CREATE INDEX idx_properties_geo ON properties
        USING GIST (ll_to_earth(latitude::float8, longitude::float8))
        WHERE status = 'active' AND deleted_at IS NULL
    """)

    # Índice full-text search
    op.execute("""
        CREATE INDEX idx_properties_search_vector ON properties
        USING GIN(search_vector)
    """)

    # Trigger para search_vector
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_search_vector()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('spanish',
                    coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('spanish',
                    coalesce(NEW.description, '')), 'B') ||
                setweight(to_tsvector('spanish',
                    coalesce(NEW.neighborhood, '')), 'C') ||
                setweight(to_tsvector('spanish',
                    coalesce(NEW.city, '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_properties_search_vector
        BEFORE INSERT OR UPDATE OF title, description, neighborhood, city
        ON properties
        FOR EACH ROW EXECUTE FUNCTION fn_update_search_vector()
    """)

    op.execute("SELECT create_updated_at_trigger('properties')")

    # Fotos
    op.create_table(
        "property_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("thumbnail_url", sa.Text),
        sa.Column("display_order", sa.SmallInteger, server_default="0"),
        sa.Column("is_primary", sa.Boolean, server_default="FALSE"),
        sa.Column("caption", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_property_photos_property",
                    "property_photos", ["property_id", "display_order"])
    op.execute("""
        CREATE UNIQUE INDEX idx_property_photos_primary
        ON property_photos(property_id) WHERE is_primary = TRUE
    """)

    # Amenidades
    op.create_table(
        "amenities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("name_es", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(100)),
        sa.Column("name_pt", sa.String(100)),
        sa.Column("icon", sa.String(100)),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("is_highlight", sa.Boolean, server_default="FALSE"),
        sa.Column("sort_order", sa.SmallInteger, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )

    op.create_table(
        "property_amenities",
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("amenity_id", UUID(as_uuid=True),
                  sa.ForeignKey("amenities.id", ondelete="CASCADE"),
                  primary_key=True),
    )
    op.create_index("idx_property_amenities_property",
                    "property_amenities", ["property_id"])

    # Reglas adicionales
    op.create_table(
        "property_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_text", sa.String(500), nullable=False),
        sa.Column("sort_order", sa.SmallInteger, server_default="0"),
    )
    op.create_index("idx_property_rules_property",
                    "property_rules", ["property_id"])


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_properties_search_vector ON properties")
    op.execute("DROP FUNCTION IF EXISTS fn_update_search_vector()")
    op.drop_table("property_rules")
    op.drop_table("property_amenities")
    op.drop_table("amenities")
    op.drop_table("property_photos")
    op.drop_table("properties")
