"""Agregar campos de auditoría para CLABE (timestamp + IP)

Revision ID: 019
Revises: 018
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("bank_clabe_set_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("bank_clabe_set_ip", sa.String(45), nullable=True))


def downgrade():
    op.drop_column("users", "bank_clabe_set_ip")
    op.drop_column("users", "bank_clabe_set_at")
