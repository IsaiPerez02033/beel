"""Campos de verificación de identidad (Didit) y teléfono.

Revision ID: 010
Revises: 009
Create Date: 2026-06-22
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tracking de la sesión de verificación de identidad con Didit
    op.add_column("users", sa.Column("identity_session_id", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("identity_status", sa.String(30), server_default=sa.text("'none'"), nullable=False),
    )  # none | pending | approved | declined
    op.add_column("users", sa.Column("identity_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("idx_users_identity_session", "users", ["identity_session_id"])


def downgrade() -> None:
    op.drop_index("idx_users_identity_session", table_name="users")
    op.drop_column("users", "phone_verified_at")
    op.drop_column("users", "identity_verified_at")
    op.drop_column("users", "identity_status")
    op.drop_column("users", "identity_session_id")
