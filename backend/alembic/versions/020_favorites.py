"""Add favorites table

Revision ID: 020
Revises: 019
Create Date: 2026-06-28
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "favorites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("user_id", "property_id", name="uq_favorite"),
    )
    op.create_index("idx_favorites_user", "favorites", ["user_id"])


def downgrade():
    op.drop_index("idx_favorites_user", table_name="favorites")
    op.drop_table("favorites")
