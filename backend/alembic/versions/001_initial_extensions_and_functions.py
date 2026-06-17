"""Extensiones de PostgreSQL y funciones base

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

Esta migración debe ejecutarse primero.
Instala las extensiones necesarias y crea las funciones compartidas.
Requiere permisos de superusuario en PostgreSQL (disponible en AWS RDS con rds_superuser).
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensiones
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "unaccent"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pg_trgm"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "cube"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "earthdistance"')

    # Función auto-update de updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_update_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    # Macro para aplicar el trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION create_updated_at_trigger(p_table TEXT)
        RETURNS VOID AS $$
        BEGIN
            EXECUTE format(
                'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
                 CREATE TRIGGER trg_%1$s_updated_at
                 BEFORE UPDATE ON %1$s
                 FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at()',
                p_table
            );
        END;
        $$ LANGUAGE plpgsql
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS create_updated_at_trigger(TEXT)")
    op.execute("DROP FUNCTION IF EXISTS fn_update_updated_at()")
    # No eliminar extensiones — pueden estar en uso por otros objetos
