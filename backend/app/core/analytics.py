"""
Sistema de captura de eventos de comportamiento para Beel.

Diseñado para:
  1. Ser llamado desde cualquier módulo sin acoplamiento
  2. No bloquear el request principal (fire-and-forget async)
  3. Capturar suficiente contexto para ML futuro
  4. Fallar silenciosamente (nunca romper el flujo de negocio)

Uso:
    from app.core.analytics import track

    # En cualquier endpoint o service:
    await track(
        event_name="property_viewed",
        user_id=current_user.id,
        session_id=session_id,
        properties={
            "property_id": str(property.id),
            "price_per_night": float(property.price_per_night),
            "source": "search",
            "search_rank": 3,
        },
        request=request,  # FastAPI Request object para extraer contexto
    )
"""

import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


# ── Catálogo de eventos (referencia) ─────────────────────────────────────────
#
# Usar estas constantes en lugar de strings literales para evitar typos.

class Events:
    # Exploración
    SEARCH_PERFORMED        = "search_performed"
    SEARCH_RESULT_CLICKED   = "search_result_clicked"
    MAP_INTERACTION         = "map_interaction"
    PROPERTY_VIEWED         = "property_viewed"
    PROPERTY_PHOTO_VIEWED   = "property_photo_viewed"
    PROPERTY_FAVORITED      = "property_favorited"
    PROPERTY_UNFAVORITED    = "property_unfavorited"
    PROPERTY_SHARED         = "property_shared"
    HOST_PROFILE_VIEWED     = "host_profile_viewed"

    # Embudo de reserva
    BOOKING_INITIATED       = "booking_initiated"
    RESERVATION_REQUESTED   = "reservation_requested"
    RESERVATION_ABANDONED   = "reservation_abandoned"
    RESERVATION_COMPLETED   = "reservation_completed"

    # Engagement
    MESSAGE_SENT            = "message_sent"
    REVIEW_WRITTEN          = "review_written"

    # Sesión
    SESSION_STARTED         = "session_started"
    SESSION_ENDED           = "session_ended"


async def track(
    event_name: str,
    properties: dict[str, Any],
    db: AsyncSession,
    user_id: Optional[UUID] = None,
    session_id: Optional[UUID] = None,
    anonymous_id: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Registra un evento de comportamiento de forma asíncrona.
    Falla silenciosamente para no interrumpir el flujo de negocio.

    Args:
        event_name: Nombre del evento (usar constantes de Events)
        properties: Datos específicos del evento
        db: Sesión de base de datos
        user_id: ID del usuario autenticado (None si anónimo)
        session_id: ID de sesión del frontend
        anonymous_id: ID anónimo pre-login
        request: Request de FastAPI para extraer contexto técnico
    """
    try:
        # Extraer contexto del request si está disponible
        device_type = None
        browser = None
        ip_country = None

        if request:
            user_agent = request.headers.get("user-agent", "").lower()
            device_type = _detect_device_type(user_agent)
            browser = _detect_browser(user_agent)

            # Cloudfront o headers de proxy para obtener país
            ip_country = (
                request.headers.get("cloudfront-viewer-country") or
                request.headers.get("x-country-code")
            )

        event_data = {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "session_id": session_id,
            "anonymous_id": anonymous_id,
            "event_name": event_name,
            "properties": properties,
            "device_type": device_type,
            "browser": browser,
            "ip_country": ip_country,
            "utm_source": request.query_params.get("utm_source") if request else None,
            "utm_medium": request.query_params.get("utm_medium") if request else None,
            "utm_campaign": request.query_params.get("utm_campaign") if request else None,
            "referrer": request.headers.get("referer") if request else None,
            "created_at": datetime.now(timezone.utc),
        }

        # Insert directo con SQL para máximo rendimiento
        # (evita overhead del ORM para inserts de alta frecuencia)
        await db.execute(
            __import__("sqlalchemy").text("""
                INSERT INTO analytics_events (
                    id, user_id, session_id, anonymous_id,
                    event_name, properties,
                    device_type, browser, ip_country,
                    utm_source, utm_medium, utm_campaign,
                    referrer, created_at
                ) VALUES (
                    :id, :user_id, :session_id, :anonymous_id,
                    :event_name, :properties::jsonb,
                    :device_type, :browser, :ip_country,
                    :utm_source, :utm_medium, :utm_campaign,
                    :referrer, :created_at
                )
            """),
            {**event_data, "properties": __import__("json").dumps(properties)},
        )

    except Exception as e:
        # Analytics nunca debe romper el flujo principal
        logger.warning(f"Analytics track failed for '{event_name}': {e}")


def _detect_device_type(user_agent: str) -> str:
    if any(mobile in user_agent for mobile in ["mobile", "android", "iphone"]):
        return "mobile"
    if "tablet" in user_agent or "ipad" in user_agent:
        return "tablet"
    return "desktop"


def _detect_browser(user_agent: str) -> str:
    if "chrome" in user_agent and "edg" not in user_agent:
        return "chrome"
    if "safari" in user_agent and "chrome" not in user_agent:
        return "safari"
    if "firefox" in user_agent:
        return "firefox"
    if "edg" in user_agent:
        return "edge"
    return "other"
