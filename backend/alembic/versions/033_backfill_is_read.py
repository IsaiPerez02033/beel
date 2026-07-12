"""Backfill: is_read=TRUE en mensajes que ya tienen read_at

Revision ID: 033
Revises: 032
Create Date: 2026-07-12

mark_read historicamente solo ponia read_at y nunca is_read, y el frontend usa
is_read para pintar las palomitas azules de "leido". Se corrige el codigo y
aqui se reparan las filas existentes. Idempotente.
"""

from alembic import op

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        "UPDATE messages SET is_read = TRUE "
        "WHERE read_at IS NOT NULL AND is_read IS DISTINCT FROM TRUE"
    )


def downgrade():
    pass
