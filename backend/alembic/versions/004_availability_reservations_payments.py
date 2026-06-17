"""Disponibilidad, reservas y pagos

Revision ID: 004
Revises: 003
Create Date: 2024-01-01 00:03:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # DISPONIBILIDAD
    op.create_table(
        "availability",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("is_available", sa.Boolean, server_default="TRUE"),
        sa.Column("price_override", sa.Numeric(10, 2)),
        sa.Column("blocked_reason", sa.String(50)),
        sa.Column("reservation_id", UUID(as_uuid=True)),  # FK añadida después
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("property_id", "date", name="uq_availability_property_date"),
    )
    op.create_index("idx_availability_property_date",
                    "availability", ["property_id", "date"])
    op.execute("SELECT create_updated_at_trigger('availability')")

    # RESERVAS
    op.create_table(
        "reservations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("guest_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("host_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("check_in", sa.Date, nullable=False),
        sa.Column("check_out", sa.Date, nullable=False),
        # nights calculado como columna generada en PostgreSQL
        sa.Column("guests_count", sa.SmallInteger, nullable=False),
        sa.Column("price_per_night_snapshot", sa.Numeric(10, 2), nullable=False),
        sa.Column("cleaning_fee_snapshot", sa.Numeric(10, 2), server_default="0"),
        sa.Column("security_deposit_snapshot", sa.Numeric(10, 2), server_default="0"),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False),
        sa.Column("platform_fee", sa.Numeric(10, 2), server_default="0"),
        sa.Column("platform_fee_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="MXN"),
        sa.Column("status", sa.String(30), server_default="pending", nullable=False),
        sa.Column("payment_status", sa.String(20), server_default="unpaid",
                  nullable=False),
        sa.Column("cancellation_policy_snapshot", sa.String(20)),
        sa.Column("guest_message", sa.Text),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("cancellation_reason", sa.Text),
        sa.Column("cancelled_by", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("no_show_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint("check_out > check_in", name="chk_dates"),
        sa.CheckConstraint("total_amount > 0", name="chk_total"),
        sa.CheckConstraint("guests_count > 0", name="chk_guests_count"),
    )

    # Agregar columna generada nights (PostgreSQL GENERATED ALWAYS)
    op.execute("""
        ALTER TABLE reservations
        ADD COLUMN nights SMALLINT
        GENERATED ALWAYS AS (check_out - check_in) STORED
    """)

    op.create_index("idx_reservations_property", "reservations", ["property_id"])
    op.create_index("idx_reservations_guest", "reservations", ["guest_id"])
    op.create_index("idx_reservations_host", "reservations", ["host_id"])
    op.create_index("idx_reservations_status", "reservations", ["status"])
    op.create_index("idx_reservations_dates",
                    "reservations", ["check_in", "check_out"])
    op.create_index("idx_reservations_created",
                    "reservations", [sa.text("created_at DESC")])
    op.execute("SELECT create_updated_at_trigger('reservations')")

    # FK circular: availability → reservations
    op.execute("""
        ALTER TABLE availability
        ADD CONSTRAINT fk_availability_reservation
        FOREIGN KEY (reservation_id) REFERENCES reservations(id)
        ON DELETE SET NULL
    """)

    # PAGOS
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("reservation_id", UUID(as_uuid=True),
                  sa.ForeignKey("reservations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), server_default="MXN"),
        sa.Column("payment_type", sa.String(20), server_default="full"),
        sa.Column("payment_provider", sa.String(20), nullable=False),
        sa.Column("provider_payment_id", sa.String(255), unique=True),
        sa.Column("provider_status", sa.String(50)),
        sa.Column("provider_response", JSONB),
        sa.Column("payment_method", sa.String(50)),
        sa.Column("payment_method_last4", sa.String(4)),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("payout_status", sa.String(20), server_default="pending"),
        sa.Column("payout_scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("payout_completed_at", sa.DateTime(timezone=True)),
        sa.Column("payout_provider_id", sa.String(255)),
        sa.Column("platform_fee_amount", sa.Numeric(10, 2), server_default="0"),
        sa.Column("processing_fee_amount", sa.Numeric(10, 2), server_default="0"),
        sa.Column("net_amount_to_host", sa.Numeric(10, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_payments_reservation", "payments", ["reservation_id"])
    op.create_index("idx_payments_provider_id", "payments", ["provider_payment_id"])
    op.create_index("idx_payments_status", "payments", ["status"])
    op.execute("SELECT create_updated_at_trigger('payments')")

    # WEBHOOKS de pagos (idempotencia)
    op.create_table(
        "payment_webhooks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("provider_event_id", sa.String(255), unique=True, nullable=False),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("processed", sa.Boolean, server_default="FALSE"),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("error_message", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_webhooks_provider_event",
                    "payment_webhooks", ["provider", "provider_event_id"])


def downgrade() -> None:
    op.drop_table("payment_webhooks")
    op.drop_table("payments")
    op.execute("""
        ALTER TABLE availability
        DROP CONSTRAINT IF EXISTS fk_availability_reservation
    """)
    op.drop_table("reservations")
    op.drop_table("availability")
