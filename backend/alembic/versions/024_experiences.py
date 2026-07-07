"""Add experiences and experience_photos tables

Revision ID: 024
Revises: 023
Create Date: 2026-06-29
"""

from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS experiences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            category VARCHAR(30) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
            address VARCHAR(500) NOT NULL,
            neighborhood VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            state VARCHAR(100) NOT NULL,
            country VARCHAR(100) NOT NULL DEFAULT 'México',
            country_code VARCHAR(3) DEFAULT 'MX',
            postal_code VARCHAR(20),
            latitude NUMERIC(10,8) NOT NULL,
            longitude NUMERIC(11,8) NOT NULL,
            latitude_approx NUMERIC(8,5),
            longitude_approx NUMERIC(8,5),
            price_per_person NUMERIC(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'MXN',
            duration_minutes SMALLINT NOT NULL DEFAULT 60,
            min_participants SMALLINT NOT NULL DEFAULT 1,
            max_participants SMALLINT NOT NULL DEFAULT 10,
            languages VARCHAR(255),
            included TEXT,
            requirements TEXT,
            instant_booking BOOLEAN DEFAULT FALSE,
            cancellation_policy VARCHAR(20) DEFAULT 'flexible',
            total_reviews INTEGER DEFAULT 0,
            avg_rating NUMERIC(3,2),
            total_bookings INTEGER DEFAULT 0,
            ranking_score NUMERIC(8,4) DEFAULT 0,
            deleted_at TIMESTAMPTZ,
            approved_by UUID REFERENCES users(id),
            approved_at TIMESTAMPTZ,
            suspension_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_host ON experiences(host_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_photos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
            url TEXT NOT NULL,
            thumbnail_url TEXT,
            display_order SMALLINT DEFAULT 0,
            is_primary BOOLEAN DEFAULT FALSE,
            caption VARCHAR(255),
            s3_key VARCHAR(500),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_experience_photos_exp ON experience_photos(experience_id)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS experience_photos")
    op.execute("DROP TABLE IF EXISTS experiences")
