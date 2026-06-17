"""Add missing indexes for availability, reservations, and analytics.

Revision ID: 007
Revises: 006_seed_amenities
Create Date: 2026-06-17
"""

from alembic import op
import sqlalchemy as sa


revision = "007"
down_revision = "006_seed_amenities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Índice para unblock rápidas de availability por reservation_id
    op.create_index(
        "idx_availability_reservation_id",
        "availability",
        ["reservation_id"],
        postgresql_where=sa.text("reservation_id IS NOT NULL"),
    )

    # Índice para detección de solapamiento de reservas (búsqueda)
    op.create_index(
        "idx_reservations_overlap",
        "reservations",
        ["property_id", "status", "check_in", "check_out"],
        postgresql_where=sa.text("status IN ('confirmed', 'pending') AND deleted_at IS NULL"),
    )

    # Índices para analytics_events
    op.create_index(
        "idx_analytics_events_created_at",
        "analytics_events",
        [sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_analytics_events_anonymous_id",
        "analytics_events",
        ["anonymous_id"],
        postgresql_where=sa.text("anonymous_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_analytics_events_anonymous_id", table_name="analytics_events")
    op.drop_index("idx_analytics_events_created_at", table_name="analytics_events")
    op.drop_index("idx_reservations_overlap", table_name="reservations")
    op.drop_index("idx_availability_reservation_id", table_name="availability")
