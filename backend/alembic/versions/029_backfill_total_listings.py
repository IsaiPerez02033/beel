"""Backfill users.total_listings desde el conteo real de propiedades

Revision ID: 029
Revises: 028
Create Date: 2026-07-09

El contador `total_listings` se mantiene de forma incremental al crear/borrar
propiedades. Los anfitriones sembrados directamente en la BD (datos demo) nunca
pasaron por esa ruta, por lo que su contador quedó en 0 aunque tuvieran
propiedades. Esta migración lo recalcula desde la fuente de verdad: el número de
propiedades no borradas de cada anfitrión. Es idempotente.
"""

from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        UPDATE users u
        SET total_listings = COALESCE(sub.cnt, 0)
        FROM (
            SELECT host_id, COUNT(*) AS cnt
            FROM properties
            WHERE deleted_at IS NULL
            GROUP BY host_id
        ) AS sub
        WHERE u.id = sub.host_id
        """
    )
    # Anfitriones sin ninguna propiedad no borrada quedan en 0.
    op.execute(
        """
        UPDATE users u
        SET total_listings = 0
        WHERE NOT EXISTS (
            SELECT 1 FROM properties p
            WHERE p.host_id = u.id AND p.deleted_at IS NULL
        )
        AND u.total_listings <> 0
        """
    )


def downgrade():
    # No-op: es una corrección de datos, no hay estado previo que restaurar.
    pass
