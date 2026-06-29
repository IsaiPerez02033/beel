"""Add favorites table

Revision ID: 020
Revises: 019
Create Date: 2026-06-28
"""

from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    # Idempotente: tolera estados parciales de despliegues previos.
    op.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_favorite UNIQUE (user_id, property_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id)")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_favorites_user")
    op.execute("DROP TABLE IF EXISTS favorites")
