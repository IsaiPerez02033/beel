"""Agrega require_guest_identity a properties (modelo híbrido de verificación).

El anfitrión puede exigir que los huéspedes tengan identidad verificada
para reservar su propiedad. Por defecto no se exige.

Revision ID: 014
Revises: 013
"""

from alembic import op


revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE properties ADD COLUMN IF NOT EXISTS "
        "require_guest_identity BOOLEAN NOT NULL DEFAULT FALSE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE properties DROP COLUMN IF EXISTS require_guest_identity")
