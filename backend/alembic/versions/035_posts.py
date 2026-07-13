"""Publicaciones de anfitriones (feed estilo Instagram) + likes

Revision ID: 035
Revises: 034
Create Date: 2026-07-12

Tabla `posts`: publicacion permanente de un anfitrion (opcionalmente ligada a
una propiedad), `post_media` con hasta 5 fotos/videos por publicacion y
`post_likes` con el corazon de cada usuario. Idempotente; constraints con
nombre explicito (leccion de la migracion 031).
"""

from alembic import op

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS posts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
            caption VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            deleted_at TIMESTAMPTZ
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS post_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 0,
            media_url TEXT NOT NULL,
            storage_key TEXT,
            media_type VARCHAR(10) NOT NULL DEFAULT 'image',
            width INTEGER,
            height INTEGER,
            duration_s INTEGER,
            CONSTRAINT chk_post_media_type CHECK (media_type IN ('image', 'video'))
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS post_likes (
            post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT pk_post_likes PRIMARY KEY (post_id, user_id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_posts_host_created ON posts (host_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id, position)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS post_likes")
    op.execute("DROP TABLE IF EXISTS post_media")
    op.execute("DROP TABLE IF EXISTS posts")
