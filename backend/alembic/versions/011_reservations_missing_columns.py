"""Agrega columnas faltantes a reservations (schema drift)

El modelo Reservation define columnas que nunca se migraron a la BD
(platform_fee_snapshot, subtotal, platform_fee_pct, payment_status, etc.),
causando UndefinedColumnError en toda query de reservas. Esta migración las
agrega de forma idempotente (ADD COLUMN IF NOT EXISTS).

Revision ID: 011
Revises: 010
"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


# (columna, definición SQL)
COLUMNS = [
    ("cleaning_fee_snapshot",      "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("security_deposit_snapshot",  "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("platform_fee_snapshot",      "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("subtotal",                   "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("platform_fee_pct",           "NUMERIC(5,2) NOT NULL DEFAULT 0"),
    ("currency",                   "VARCHAR(3) NOT NULL DEFAULT 'MXN'"),
    ("rejection_reason",           "TEXT"),
    ("cancellation_reason",        "TEXT"),
    ("host_message",               "TEXT"),
    ("guest_message",              "TEXT"),
    ("host_response_deadline",     "TIMESTAMPTZ"),
    ("payout_scheduled_at",        "TIMESTAMPTZ"),
    ("payout_released_at",         "TIMESTAMPTZ"),
    ("payment_status",             "VARCHAR(20) NOT NULL DEFAULT 'unpaid'"),
    ("guest_reviewed_at",          "TIMESTAMPTZ"),
    ("host_reviewed_at",           "TIMESTAMPTZ"),
    ("metadata",                   "JSONB"),
]


def upgrade() -> None:
    for name, ddl in COLUMNS:
        op.execute(f'ALTER TABLE reservations ADD COLUMN IF NOT EXISTS {name} {ddl}')
    # reviews: el modelo tiene 'flagged' que no estaba en la migración.
    op.execute("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS flagged BOOLEAN NOT NULL DEFAULT FALSE")


def downgrade() -> None:
    # Solo quitamos las claramente nuevas para no romper datos existentes.
    for name in ("platform_fee_snapshot", "subtotal", "platform_fee_pct"):
        op.execute(f'ALTER TABLE reservations DROP COLUMN IF EXISTS {name}')
