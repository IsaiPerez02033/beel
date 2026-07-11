"""Permitir message_type 'image' en messages

Revision ID: 030
Revises: 029
Create Date: 2026-07-11

El CHECK chk_message_type solo permitia ('text','system','reservation_update').
Se recrea incluyendo 'image' para soportar fotos en el chat. Idempotente.
"""

from alembic import op

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_message_type")
    op.execute(
        """
        ALTER TABLE messages ADD CONSTRAINT chk_message_type
        CHECK (message_type IN ('text', 'system', 'reservation_update', 'image'))
        """
    )


def downgrade():
    op.execute("ALTER TABLE messages DROP CONSTRAINT IF EXISTS chk_message_type")
    op.execute(
        """
        ALTER TABLE messages ADD CONSTRAINT chk_message_type
        CHECK (message_type IN ('text', 'system', 'reservation_update'))
        """
    )
