"""Add experience_booking_id to payments and make reservation_id nullable

Revision ID: 026
Revises: 025
Create Date: 2026-07-08
"""

from alembic import op

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade():
    # Columna para pagos de experiencias (nullable).
    op.execute("""
        ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS experience_booking_id UUID
        REFERENCES experience_bookings(id) ON DELETE RESTRICT
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_payments_experience_booking "
        "ON payments(experience_booking_id)"
    )
    # Un pago ahora referencia una reserva de alojamiento O una de experiencia.
    op.execute("ALTER TABLE payments ALTER COLUMN reservation_id DROP NOT NULL")


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_payments_experience_booking")
    op.execute("ALTER TABLE payments DROP COLUMN IF EXISTS experience_booking_id")
    # No se re-impone NOT NULL en reservation_id para no romper filas de experiencias.
