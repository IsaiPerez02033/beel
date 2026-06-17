"""Mensajería, reseñas, notificaciones y analytics de comportamiento

Revision ID: 005
Revises: 004
Create Date: 2024-01-01 00:04:00.000000

NOTA SOBRE MENSAJERÍA (SSE → WebSockets):
Este schema es transport-agnostic. Para migrar de SSE a WebSockets
en el futuro, solo necesitas cambiar:
  - backend/app/modules/messaging/router.py  (StreamingResponse → WebSocket)
  - frontend/hooks/useChat.ts               (EventSource → WebSocket)
El schema de esta migración no cambia.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CONVERSACIONES
    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("reservation_id", UUID(as_uuid=True),
                  sa.ForeignKey("reservations.id", ondelete="SET NULL")),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guest_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("host_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_message_preview", sa.String(255)),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("last_message_sender_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id")),
        sa.Column("unread_count_host", sa.Integer, server_default="0"),
        sa.Column("unread_count_guest", sa.Integer, server_default="0"),
        sa.Column("is_pre_booking", sa.Boolean, server_default="TRUE"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.UniqueConstraint("reservation_id",
                            name="uq_conversations_reservation",
                            deferrable=True,
                            initially="DEFERRED"),
    )
    op.create_index("idx_conversations_guest",
                    "conversations",
                    ["guest_id", sa.text("last_message_at DESC")])
    op.create_index("idx_conversations_host",
                    "conversations",
                    ["host_id", sa.text("last_message_at DESC")])
    op.create_index("idx_conversations_reservation",
                    "conversations", ["reservation_id"])
    op.execute("SELECT create_updated_at_trigger('conversations')")

    # MENSAJES
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("conversation_id", UUID(as_uuid=True),
                  sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("message_type", sa.String(20), server_default="text"),
        sa.Column("metadata", JSONB),
        sa.Column("is_read", sa.Boolean, server_default="FALSE"),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by_sender", sa.Boolean, server_default="FALSE"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "message_type IN ('text','system','reservation_update')",
            name="chk_message_type"
        ),
        sa.CheckConstraint(
            "length(content) > 0 AND length(content) <= 2000",
            name="chk_message_length"
        ),
    )
    op.create_index("idx_messages_conversation_time",
                    "messages", ["conversation_id", sa.text("created_at ASC")])

    # Trigger: actualizar preview de conversación
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_conversation_preview()
        RETURNS TRIGGER AS $$
        DECLARE
            v_host_id UUID;
            v_guest_id UUID;
        BEGIN
            SELECT host_id, guest_id
            INTO v_host_id, v_guest_id
            FROM conversations WHERE id = NEW.conversation_id;

            UPDATE conversations SET
                last_message_preview   = LEFT(NEW.content, 255),
                last_message_at        = NEW.created_at,
                last_message_sender_id = NEW.sender_id,
                unread_count_host  = CASE
                    WHEN v_host_id = NEW.sender_id
                    THEN unread_count_host
                    ELSE unread_count_host + 1
                END,
                unread_count_guest = CASE
                    WHEN v_guest_id = NEW.sender_id
                    THEN unread_count_guest
                    ELSE unread_count_guest + 1
                END
            WHERE id = NEW.conversation_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_messages_update_conversation
        AFTER INSERT ON messages
        FOR EACH ROW EXECUTE FUNCTION fn_update_conversation_preview()
    """)

    # RESEÑAS
    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("reservation_id", UUID(as_uuid=True),
                  sa.ForeignKey("reservations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reviewee_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("review_type", sa.String(20), nullable=False),
        sa.Column("overall_rating", sa.SmallInteger, nullable=False),
        sa.Column("cleanliness_rating", sa.SmallInteger),
        sa.Column("communication_rating", sa.SmallInteger),
        sa.Column("location_rating", sa.SmallInteger),
        sa.Column("value_rating", sa.SmallInteger),
        sa.Column("comment", sa.Text),
        sa.Column("is_published", sa.Boolean, server_default="FALSE"),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("response_text", sa.Text),
        sa.Column("response_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
        sa.CheckConstraint(
            "review_type IN ('guest_to_host','host_to_guest')",
            name="chk_review_type"
        ),
        sa.CheckConstraint(
            "overall_rating BETWEEN 1 AND 5",
            name="chk_overall_rating"
        ),
        sa.UniqueConstraint("reservation_id", "review_type",
                            name="uq_reviews_reservation_type"),
    )
    op.create_index("idx_reviews_property", "reviews", ["property_id"])
    op.create_index("idx_reviews_reviewee", "reviews", ["reviewee_id"])
    op.execute("SELECT create_updated_at_trigger('reviews')")

    # Trigger: actualizar métricas de propiedad al publicar reseña
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_property_ratings()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_published = TRUE AND NEW.review_type = 'guest_to_host' THEN
                UPDATE properties SET
                    total_reviews     = (SELECT COUNT(*) FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host'),
                    avg_rating        = (SELECT ROUND(AVG(overall_rating)::numeric, 2)
                                         FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host'),
                    avg_cleanliness   = (SELECT ROUND(AVG(cleanliness_rating)::numeric, 2)
                                         FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host'),
                    avg_communication = (SELECT ROUND(AVG(communication_rating)::numeric, 2)
                                         FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host'),
                    avg_location      = (SELECT ROUND(AVG(location_rating)::numeric, 2)
                                         FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host'),
                    avg_value         = (SELECT ROUND(AVG(value_rating)::numeric, 2)
                                         FROM reviews
                                         WHERE property_id = NEW.property_id
                                         AND is_published = TRUE
                                         AND review_type = 'guest_to_host')
                WHERE id = NEW.property_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        CREATE TRIGGER trg_reviews_update_property_ratings
        AFTER INSERT OR UPDATE OF is_published ON reviews
        FOR EACH ROW EXECUTE FUNCTION fn_update_property_ratings()
    """)

    # NOTIFICACIONES
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(60), nullable=False),
        sa.Column("title", sa.String(255)),
        sa.Column("body", sa.Text),
        sa.Column("data", JSONB),
        sa.Column("send_email", sa.Boolean, server_default="TRUE"),
        sa.Column("send_whatsapp", sa.Boolean, server_default="TRUE"),
        sa.Column("send_in_app", sa.Boolean, server_default="TRUE"),
        sa.Column("email_sent", sa.Boolean, server_default="FALSE"),
        sa.Column("email_sent_at", sa.DateTime(timezone=True)),
        sa.Column("email_error", sa.Text),
        sa.Column("whatsapp_sent", sa.Boolean, server_default="FALSE"),
        sa.Column("whatsapp_sent_at", sa.DateTime(timezone=True)),
        sa.Column("whatsapp_error", sa.Text),
        sa.Column("whatsapp_message_id", sa.String(255)),
        sa.Column("is_read", sa.Boolean, server_default="FALSE"),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_notifications_user",
                    "notifications",
                    ["user_id", sa.text("created_at DESC")])

    # ANALYTICS — eventos de comportamiento
    op.create_table(
        "analytics_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("session_id", UUID(as_uuid=True)),
        sa.Column("anonymous_id", sa.String(255)),
        sa.Column("event_name", sa.String(100), nullable=False),
        sa.Column("properties", JSONB, nullable=False, server_default="{}"),
        sa.Column("device_type", sa.String(20)),
        sa.Column("os", sa.String(50)),
        sa.Column("browser", sa.String(50)),
        sa.Column("app_version", sa.String(20)),
        sa.Column("ip_country", sa.String(2)),
        sa.Column("ip_city", sa.String(100)),
        sa.Column("utm_source", sa.String(100)),
        sa.Column("utm_medium", sa.String(100)),
        sa.Column("utm_campaign", sa.String(100)),
        sa.Column("referrer", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_analytics_user_events",
                    "analytics_events",
                    ["user_id", "event_name", sa.text("created_at DESC")])
    op.create_index("idx_analytics_event_name",
                    "analytics_events",
                    ["event_name", sa.text("created_at DESC")])
    op.create_index("idx_analytics_session",
                    "analytics_events",
                    ["session_id", sa.text("created_at ASC")])

    # FAVORITOS
    op.create_table(
        "property_favorites",
        sa.Column("user_id", UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("property_id", UUID(as_uuid=True),
                  sa.ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("NOW()"), nullable=False),
    )
    op.create_index("idx_favorites_user",
                    "property_favorites",
                    ["user_id", sa.text("created_at DESC")])
    op.create_index("idx_favorites_property",
                    "property_favorites", ["property_id"])


def downgrade() -> None:
    op.drop_table("property_favorites")
    op.drop_table("analytics_events")
    op.drop_table("notifications")
    op.execute("DROP TRIGGER IF EXISTS trg_reviews_update_property_ratings ON reviews")
    op.execute("DROP FUNCTION IF EXISTS fn_update_property_ratings()")
    op.drop_table("reviews")
    op.execute("DROP TRIGGER IF EXISTS trg_messages_update_conversation ON messages")
    op.execute("DROP FUNCTION IF EXISTS fn_update_conversation_preview()")
    op.drop_table("messages")
    op.drop_table("conversations")
