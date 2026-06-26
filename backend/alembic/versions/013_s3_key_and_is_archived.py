"""Agrega s3_key a property_photos e is_archived a conversations.

Revision ID: 013
Revises: 012
Create Date: 2026-06-26
"""

from alembic import op
import sqlalchemy as sa


revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE property_photos ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE conversations DROP COLUMN IF EXISTS is_archived")
    op.execute("ALTER TABLE property_photos DROP COLUMN IF EXISTS s3_key")
