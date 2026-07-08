"""Add experience_bookings table

Revision ID: 025
Revises: 024
Create Date: 2026-07-08
"""

from alembic import op

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS experience_bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE RESTRICT,
            guest_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            host_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            booking_date DATE NOT NULL,
            start_time TIME,
            participants SMALLINT NOT NULL DEFAULT 1,
            price_per_person_snapshot NUMERIC(10,2) NOT NULL,
            subtotal NUMERIC(10,2) DEFAULT 0,
            platform_fee_snapshot NUMERIC(10,2) DEFAULT 0,
            platform_fee_pct NUMERIC(5,2) DEFAULT 0,
            total_amount NUMERIC(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'MXN',
            lodging_iva_snapshot NUMERIC(10,2) DEFAULT 0,
            host_has_rfc BOOLEAN DEFAULT FALSE,
            isr_retention_pct NUMERIC(5,2) DEFAULT 0,
            iva_retention_pct NUMERIC(5,2) DEFAULT 0,
            isr_retention_snapshot NUMERIC(10,2) DEFAULT 0,
            iva_retention_snapshot NUMERIC(10,2) DEFAULT 0,
            host_net_payout NUMERIC(10,2) DEFAULT 0,
            cancellation_policy_snapshot VARCHAR(20) DEFAULT 'flexible',
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            rejection_reason TEXT,
            cancellation_reason TEXT,
            host_message TEXT,
            guest_message TEXT,
            host_response_deadline TIMESTAMPTZ,
            payout_scheduled_at TIMESTAMPTZ,
            payout_released_at TIMESTAMPTZ,
            payment_status VARCHAR(20) DEFAULT 'unpaid',
            guest_reviewed_at TIMESTAMPTZ,
            host_reviewed_at TIMESTAMPTZ,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_bookings_experience ON experience_bookings(experience_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_bookings_guest ON experience_bookings(guest_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_bookings_host ON experience_bookings(host_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_exp_bookings_status ON experience_bookings(status)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS experience_bookings")
