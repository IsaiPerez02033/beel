"""
Cache con Redis para Beel.

Patrón: cache-aside.
  - get_cached / set_cached / invalidate para uso general.
  - Decorador @cached para cachear el resultado de funciones async.

TTLs configurados en Settings:
  CACHE_TTL_SEARCH       = 300 s  (resultados de búsqueda)
  CACHE_TTL_PROPERTY     = 120 s  (detalle de propiedad)
  CACHE_TTL_USER_PROFILE = 600 s  (perfil de usuario)
  CACHE_TTL_RANKING      = 3600 s (scores de ranking)
"""

import asyncio
import json
import logging
from functools import wraps
from typing import Any, Callable, Optional

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Pool de conexiones Redis (inicializado en el primer uso)
_redis_pool: Optional[aioredis.Redis] = None
_init_lock = asyncio.Lock()
_disabled = not settings.REDIS_URL


async def get_cache() -> Optional[aioredis.Redis]:
    """Retorna el cliente Redis o None si no está configurado."""
    global _redis_pool, _disabled
    if _disabled:
        return None
    if _redis_pool is not None:
        return _redis_pool
    async with _init_lock:
        if _redis_pool is not None:
            return _redis_pool
        try:
            _redis_pool = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20,
            )
        except Exception:
            logger.warning("Redis no disponible — cache deshabilitado")
            _disabled = True
            return None
    return _redis_pool


def _get_redis() -> Optional[aioredis.Redis]:
    """Versión sync wrapper para compatibilidad con código existente."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return None
    if _disabled:
        return None
    return _redis_pool


async def get_cached(key: str) -> Optional[Any]:
    """Retorna el valor cacheado o None si no existe."""
    try:
        redis = await get_cache()
        if redis is None:
            return None
        raw = await redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.debug("Cache GET error [%s]: %s", key, e)
        return None


async def set_cached(key: str, value: Any, ttl: int) -> None:
    """Guarda un valor en cache con TTL en segundos."""
    try:
        redis = await get_cache()
        if redis is None:
            return
        await redis.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as e:
        logger.debug("Cache SET error [%s]: %s", key, e)


async def invalidate(pattern: str) -> int:
    """Elimina claves que coincidan con el patrón usando SCAN."""
    try:
        redis = await get_cache()
        if redis is None:
            return 0
        cursor = 0
        deleted = 0
        while True:
            cursor, keys = await redis.scan(cursor, match=pattern, count=100)
            if keys:
                deleted += await redis.delete(*keys)
            if cursor == 0:
                break
        return deleted
    except Exception as e:
        logger.debug("Cache INVALIDATE error [%s]: %s", pattern, e)
        return 0


async def get_or_set(key: str, factory: Callable, ttl: int) -> Any:
    """
    Cache-aside con lock para prevenir cache stampede.
    Si la clave no existe, solo un request la regenera; los demás esperan.
    """
    cached = await get_cached(key)
    if cached is not None:
        return cached

    lock_key = f"{key}:lock"
    try:
        redis = _get_redis()
        locked = await redis.set(lock_key, "1", nx=True, ex=5)
        if locked:
            value = await factory()
            await set_cached(key, value, ttl)
            return value
        else:
            # Esperar a que el lock se libere, luego leer cache
            for _ in range(10):
                await asyncio.sleep(0.1)
                value = await get_cached(key)
                if value is not None:
                    return value
            # Timeout: regenerar igual
            value = await factory()
            await set_cached(key, value, ttl)
            return value
    except Exception:
        # Sin Redis, ejecutar factory directamente
        return await factory()


# ── Prefijos de claves ────────────────────────────────────────────────────────

def property_key(property_id: str) -> str:
    return f"beel:property:{property_id}"


def search_key(**params) -> str:
    """Genera una clave de cache para una búsqueda a partir de sus params."""
    sorted_params = sorted(
        (k, str(v)) for k, v in params.items() if v is not None
    )
    param_str = ":".join(f"{k}={v}" for k, v in sorted_params)
    return f"beel:search:{param_str}"


def user_key(user_id: str) -> str:
    return f"beel:user:{user_id}"


def ranking_key() -> str:
    return "beel:ranking:scores"
