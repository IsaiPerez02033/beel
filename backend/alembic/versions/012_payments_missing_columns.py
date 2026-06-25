"""Agrega columnas faltantes a payments (schema drift)

El modelo Payment define columnas (mp_preference_id, mp_payment_id,
host_payout, payment_method, mp_response, payout_at, etc.) que no se
migraron, causando UndefinedColumnError y 500 en el panel de admin.

Revision ID: 012
Revises: 011
"""
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


COLUMNS = [
    ("mp_preference_id",      "VARCHAR(255)"),
    ("mp_payment_id",         "VARCHAR(255)"),
    ("mp_merchant_order_id",  "VARCHAR(255)"),
    ("currency",              "VARCHAR(3) NOT NULL DEFAULT 'MXN'"),
    ("platform_fee",          "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("host_payout",           "NUMERIC(10,2) NOT NULL DEFAULT 0"),
    ("payment_method",        "VARCHAR(100)"),
    ("failure_reason",        "TEXT"),
    ("mp_response",           "JSONB"),
    ("payout_status",         "VARCHAR(30) NOT NULL DEFAULT 'pending'"),
    ("payout_at",             "TIMESTAMPTZ"),
    ("beel_approved_at",      "TIMESTAMPTZ"),
    ("beel_approved_by",      "VARCHAR(255)"),
    ("refund_id",             "VARCHAR(255)"),
    ("refunded_at",           "TIMESTAMPTZ"),
    ("refund_reason",         "TEXT"),
]


def upgrade() -> None:
    for name, ddl in COLUMNS:
        op.execute(f'ALTER TABLE payments ADD COLUMN IF NOT EXISTS {name} {ddl}')
    op.execute("CREATE INDEX IF NOT EXISTS idx_payments_mp_preference ON payments (mp_preference_id)")


def downgrade() -> None:
    for name in ("mp_preference_id", "mp_payment_id", "mp_merchant_order_id",
                 "host_payout", "payment_method", "failure_reason",
                 "mp_response", "payout_at"):
        op.execute(f'ALTER TABLE payments DROP COLUMN IF EXISTS {name}')
