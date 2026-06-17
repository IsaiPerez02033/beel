"""Módulo de usuarios y verificaciones de identidad

Revision ID: 002
Revises: 001
Create Date: 2024-01-01 00:01:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("clerk_id", sa.String(255), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("phone", sa.String(30)),
        sa.Column("phone_country_code", sa.String(5), server_default="+52"),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("avatar_url", sa.Text),
        sa.Column("role", sa.String(20), nullable=False, server_default="guest"),
        sa.Column("is_phone_verified", sa.Boolean, server_default="FALSE"),
        sa.Column("is_identity_verified", sa.Boolean, server_default="FALSE"),
        sa.Column("is_active", sa.Boolean, server_default="TRUE"),
        sa.Column("preferred_language", sa.String(5), server_default="es"),
        sa.Column("host_since", sa.DateTime(timezone=True)),
        sa.Column("total_listings", sa.Integer, server_default="0"),
        sa.Column("total_trips", sa.Integer, server_default="0"),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint("role IN ('guest','host','admin')", name="chk_users_role"),
    )

    op.create_index("idx_users_clerk_id", "users", ["clerk_id"])
    op.create_index("idx_users_email", "users", ["email"])
    op.execute("SELECT create_updated_at_trigger('users')")

    op.create_table(
        "identity_verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_type", sa.String(50)),
        sa.Column("document_front_url", sa.Text, nullable=False),
        sa.Column("document_back_url", sa.Text),
        sa.Column("selfie_url", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("reviewed_by", UUID(as_uuid=True),
                  sa.ForeignKey("users.id")),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('pending','approved','rejected')",
            name="chk_identity_status"
        ),
    )

    op.create_index("idx_identity_verif_user_id",
                    "identity_verifications", ["user_id"])
    op.execute("SELECT create_updated_at_trigger('identity_verifications')")


def downgrade() -> None:
    op.drop_table("identity_verifications")
    op.drop_table("users")
