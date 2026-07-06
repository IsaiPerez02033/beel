"""Add lodging IVA snapshot to reservations

Revision ID: 023
Revises: 022
Create Date: 2026-06-29
"""

from alembic import op

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS lodging_iva_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0
    """)


def downgrade():
    op.execute("ALTER TABLE reservations DROP COLUMN IF EXISTS lodging_iva_snapshot")
