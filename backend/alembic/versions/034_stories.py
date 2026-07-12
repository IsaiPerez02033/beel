"""Historias de anfitriones (estilo Instagram, 24h) + vistas

Revision ID: 034
Revises: 033
Create Date: 2026-07-12

Tabla `stories`: foto (video en fase 2) publicada por un anfitrion, opcionalmente
ligada a una propiedad, con expiracion a 24h. `story_views` registra que usuario
ya vio cada historia (anillo verde/gris y conteo de vistas). Idempotente.
"""

from alembic import op

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
            media_url TEXT NOT NULL,
            storage_key TEXT,
            media_type VARCHAR(10) NOT NULL DEFAULT 'image',
            caption VARCHAR(200),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            deleted_at TIMESTAMPTZ,
            CONSTRAINT chk_story_media_type CHECK (media_type IN ('image', 'video'))
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS story_views (
            story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
            viewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_story_views PRIMARY KEY (story_id, viewer_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories (expires_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_stories_host_created ON stories (host_id, created_at)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS story_views")
    op.execute("DROP TABLE IF EXISTS stories")
