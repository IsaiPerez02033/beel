"""Clave de idempotencia en mensajes (client_id)

Revision ID: 036
Revises: 035
Create Date: 2026-07-13

El cliente genera un client_id (UUID) por mensaje y lo manda en el POST. Si el
proxy devuelve 504 despues de que el backend ya creo el mensaje, el reintento
automatico del frontend repite el mismo client_id y el backend devuelve el
mensaje existente en vez de duplicarlo (duplicaba filas e inflaba al doble el
contador de no-leidos). Indice unico parcial con nombre explicito.
"""

from alembic import op

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id VARCHAR(64)")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_conv_client
        ON messages (conversation_id, client_id)
        WHERE client_id IS NOT NULL
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_messages_conv_client")
    op.execute("ALTER TABLE messages DROP COLUMN IF EXISTS client_id")
