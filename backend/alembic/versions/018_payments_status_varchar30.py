"""Ampliar payments.status y payout_status a VARCHAR(30)

Revision ID: 018
Revises: 017
Create Date: 2026-06-27
"""

from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE VARCHAR(30)")
    op.execute("ALTER TABLE payments ALTER COLUMN payout_status TYPE VARCHAR(30)")


def downgrade():
    op.execute("ALTER TABLE payments ALTER COLUMN status TYPE VARCHAR(20)")
    op.execute("ALTER TABLE payments ALTER COLUMN payout_status TYPE VARCHAR(20)")
