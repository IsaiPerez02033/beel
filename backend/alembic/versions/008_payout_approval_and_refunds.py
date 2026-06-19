"""Aprobación de payouts y reembolsos por admin de Beel

Revision ID: 008
Revises: 007
Create Date: 2024-01-01 00:07:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Columnas de aprobación de payout por admin de Beel
    op.add_column("payments", sa.Column("beel_approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("beel_approved_by", sa.String(255), nullable=True))

    # Columnas de reembolso
    op.add_column("payments", sa.Column("refund_id", sa.String(255), nullable=True))
    op.add_column("payments", sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("payments", sa.Column("refund_reason", sa.Text, nullable=True))

    # Índice para buscar reembolsos por refund_id de MP
    op.create_index("idx_payments_refund_id", "payments", ["refund_id"])


def downgrade() -> None:
    op.drop_index("idx_payments_refund_id", table_name="payments")
    op.drop_column("payments", "refund_reason")
    op.drop_column("payments", "refunded_at")
    op.drop_column("payments", "refund_id")
    op.drop_column("payments", "beel_approved_by")
    op.drop_column("payments", "beel_approved_at")
