"""Tabla push_subscriptions para Web Push (PWA instalada)

Revision ID: 031
Revises: 030
Create Date: 2026-07-11

Guarda las suscripciones Web Push (endpoint + claves) por usuario para enviar
notificaciones a telefonos con la PWA instalada. Idempotente.
"""

from alembic import op

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent VARCHAR(255),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id)"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS push_subscriptions")
