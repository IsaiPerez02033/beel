"""Add tax retention snapshots to reservations and payments

Revision ID: 022
Revises: 021
Create Date: 2026-06-29
"""

from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS host_has_rfc BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS isr_retention_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS iva_retention_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS isr_retention_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS iva_retention_snapshot NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS host_net_payout NUMERIC(10,2) NOT NULL DEFAULT 0
    """)
    op.execute("""
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS isr_retention NUMERIC(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS iva_retention NUMERIC(10,2) NOT NULL DEFAULT 0
    """)


def downgrade():
    op.execute("""
        ALTER TABLE reservations
        DROP COLUMN IF EXISTS host_has_rfc,
        DROP COLUMN IF EXISTS isr_retention_pct,
        DROP COLUMN IF EXISTS iva_retention_pct,
        DROP COLUMN IF EXISTS isr_retention_snapshot,
        DROP COLUMN IF EXISTS iva_retention_snapshot,
        DROP COLUMN IF EXISTS host_net_payout
    """)
    op.execute("""
        ALTER TABLE payments
        DROP COLUMN IF EXISTS isr_retention,
        DROP COLUMN IF EXISTS iva_retention
    """)
