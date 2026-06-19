"""Agrega campos de NextAuth (credentials + Google) a la tabla users.

Revision ID: 009
Revises: 008
Create Date: 2024-01-01
"""

from alembic import op
import sqlalchemy as sa


revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Hacer clerk_id nullable (los nuevos usuarios no tienen clerk_id)
    op.alter_column("users", "clerk_id", nullable=True)

    # Nuevos campos para NextAuth
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean, server_default=sa.text("FALSE"), nullable=False),
    )
    op.add_column("users", sa.Column("google_id", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "provider",
            sa.String(50),
            server_default=sa.text("'credentials'"),
            nullable=False,
        ),
    )

    # Índice único parcial en google_id (solo cuando no es NULL)
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id "
        "ON users (google_id) WHERE google_id IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_users_google_id")
    op.drop_column("users", "provider")
    op.drop_column("users", "google_id")
    op.drop_column("users", "email_verified")
    op.drop_column("users", "password_hash")
    op.alter_column("users", "clerk_id", nullable=False)
