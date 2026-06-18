"""
Configuración de base de datos para Beel.
Usa SQLAlchemy 2.0 con soporte async (asyncpg).

Si DATABASE_URL no está configurado, la app arranca sin BD.
"""
import logging
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, func
from datetime import datetime
from typing import AsyncGenerator, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

engine = None
AsyncSessionLocal = None

if settings.has_database:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DATABASE_ECHO,
        pool_size=10,
        max_overflow=20,
        pool_timeout=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    AsyncSessionLocal = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


class Base(DeclarativeBase):
    """
    Clase base para todos los modelos SQLAlchemy de Beel.
    Incluye campos de auditoría comunes.
    """
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


class TimestampMixin:
    """
    Mixin con campos de auditoría de tiempo.
    Herédar en modelos que necesiten created_at / updated_at.
    El trigger de PostgreSQL actualiza updated_at automáticamente.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


async def get_db() -> AsyncGenerator[Optional[AsyncSession], None]:
    """
    Dependency de FastAPI para inyección de sesión de BD.
    Retorna None si la BD no está configurada.
    """
    if not AsyncSessionLocal:
        yield None
        return

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            await session.invalidate()
            raise
        finally:
            await session.close()


async def dispose_engine() -> None:
    """Libera todas las conexiones del pool al apagar la aplicación."""
    if engine:
        await engine.dispose()


async def init_db() -> None:
    """
    Verifica que la BD esté disponible. No-op si no hay DATABASE_URL.
    """
    if not engine:
        logger.warning("Sin DATABASE_URL — app en modo sin base de datos")
        return
    async with engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: sync_conn.execute(
            __import__('sqlalchemy').text("SELECT 1")
        ))
    logger.info("Base de datos conectada")
