"""Eliminar TODOS los CHECK de message_type y recrear incluyendo 'image'

Revision ID: 032
Revises: 031
Create Date: 2026-07-12

La 030 hacia DROP CONSTRAINT IF EXISTS chk_message_type, pero la BD de
produccion se creo desde database/schema.sql, donde el CHECK es inline y sin
nombre (Postgres lo auto-nombro messages_message_type_check). Ese CHECK viejo
sin 'image' seguia vivo y rompia el envio de fotos en el chat (IntegrityError
-> 500). Aqui se eliminan todos los CHECK que mencionen message_type, sea cual
sea su nombre, y se recrea uno solo con 'image'. Idempotente.
"""

from alembic import op

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'messages'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%message_type%'
          LOOP
            EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', r.conname);
          END LOOP;
        END $$;
        """
    )
    op.execute(
        """
        ALTER TABLE messages ADD CONSTRAINT chk_message_type
        CHECK (message_type IN ('text', 'system', 'reservation_update', 'image'))
        """
    )


def downgrade():
    # Mantener el CHECK con 'image'; no hay estado previo seguro que restaurar.
    pass
