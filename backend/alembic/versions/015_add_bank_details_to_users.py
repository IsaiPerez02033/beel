"""Agrega campos de datos bancarios a users.

Para que el anfitrión pueda agregar su banco, cuenta CLABE y titular
y recibir transferencias en la fase de producción completa.

Revision ID: 015
Revises: 014
"""

from alembic import op


revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users "
        "ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100), "
        "ADD COLUMN IF NOT EXISTS bank_clabe VARCHAR(50), "
        "ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE users "
        "DROP COLUMN IF EXISTS bank_name, "
        "DROP COLUMN IF EXISTS bank_clabe, "
        "DROP COLUMN IF EXISTS bank_account_holder"
    )
