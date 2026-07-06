"""Add RFC (datos fiscales) to users

Revision ID: 021
Revises: 020
Create Date: 2026-06-29
"""

from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS rfc VARCHAR(13),
        ADD COLUMN IF NOT EXISTS rfc_set_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rfc_set_ip VARCHAR(45)
    """)


def downgrade():
    op.execute("""
        ALTER TABLE users
        DROP COLUMN IF EXISTS rfc,
        DROP COLUMN IF EXISTS rfc_set_at,
        DROP COLUMN IF EXISTS rfc_set_ip
    """)
