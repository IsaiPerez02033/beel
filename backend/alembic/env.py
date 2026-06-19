"""
Configuración de Alembic para Beel con soporte async (asyncpg).

Comandos más usados:
    alembic revision --autogenerate -m "descripcion"  # genera migración
    alembic upgrade head                               # aplica todas las migraciones
    alembic downgrade -1                              # revierte la última migración
    alembic current                                   # versión actual de la BD
    alembic history                                   # historial de migraciones
"""

import asyncio
from logging.config import fileConfig
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Importar Base para que Alembic detecte los modelos automáticamente
from app.core.database import Base
from app.core.config import settings

# Importar todos los modelos para que Alembic los encuentre
# IMPORTANTE: agregar aquí cada nuevo módulo que crees
import app.modules.properties.models      # noqa: F401
import app.modules.users.models           # noqa: F401
import app.modules.reservations.models    # noqa: F401
import app.modules.payments.models        # noqa: F401
import app.modules.messaging.models       # noqa: F401
import app.modules.reviews.models         # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Apuntar al metadata de Base para detección automática de cambios
target_metadata = Base.metadata

# Convenciones de naming para constraints — genera nombres predecibles
# en las migraciones en lugar de los nombres automáticos de PostgreSQL
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Sobreescribir la URL de BD con la de la configuración de la app
if not settings.DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL no está configurada. "
        "Agrégala como variable de entorno en Render."
    )
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """
    Modo offline: genera SQL sin conectarse a la BD.
    Útil para generar scripts de migración para ejecutar manualmente.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,              # detecta cambios de tipo de columna
        compare_server_default=True,    # detecta cambios en valores por defecto
        naming_convention=naming_convention,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        naming_convention=naming_convention,
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Modo online async — conecta a la BD y ejecuta las migraciones."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,        # una conexión por migración, sin pool
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Entry point para migraciones online."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
