"""Add terms_accepted_at to users

Revision ID: 028
Revises: 027
Create Date: 2026-07-09
"""

from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ")
    # Grandfather: a los usuarios existentes se les da por aceptado en su fecha
    # de alta, para no bloquearlos. Solo los NUEVOS (post-migración) sin valor
    # tendrán que aceptar.
    op.execute("UPDATE users SET terms_accepted_at = created_at WHERE terms_accepted_at IS NULL")


def downgrade():
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_accepted_at")
