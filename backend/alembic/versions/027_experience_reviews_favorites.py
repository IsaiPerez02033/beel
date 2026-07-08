"""Add experience_reviews and experience_favorites tables

Revision ID: 027
Revises: 026
Create Date: 2026-07-08
"""

from alembic import op

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            booking_id UUID NOT NULL REFERENCES experience_bookings(id) ON DELETE RESTRICT,
            reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            rating SMALLINT NOT NULL,
            comment TEXT,
            response_text TEXT,
            response_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_exp_review_per_booking UNIQUE (booking_id),
            CONSTRAINT chk_exp_review_rating CHECK (rating BETWEEN 1 AND 5)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_reviews_experience ON experience_reviews(experience_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_reviews_booking ON experience_reviews(booking_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_favorites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_exp_favorite UNIQUE (user_id, experience_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_favorites_user ON experience_favorites(user_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS experience_favorites")
    op.execute("DROP TABLE IF EXISTS experience_reviews")
