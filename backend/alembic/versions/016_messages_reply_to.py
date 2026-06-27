"""Add reply_to_id to messages

Revision ID: 016
Revises: 015
Create Date: 2026-06-27
"""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "messages",
        sa.Column(
            "reply_to_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_messages_reply_to", "messages", ["reply_to_id"])


def downgrade():
    op.drop_index("idx_messages_reply_to", table_name="messages")
    op.drop_column("messages", "reply_to_id")
