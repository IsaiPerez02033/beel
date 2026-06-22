"""
Verificación de teléfono con Twilio Verify (SMS y WhatsApp).

Twilio Verify maneja la generación del código OTP, expiración y reintentos.
Nosotros solo disparamos el envío y verificamos el código.

Config (.env):
    TWILIO_ACCOUNT_SID=ACxxxxx
    TWILIO_AUTH_TOKEN=xxxxx
    TWILIO_VERIFY_SERVICE_SID=VAxxxxx
"""

import logging
from typing import Literal

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

Channel = Literal["sms", "whatsapp"]


def twilio_configured() -> bool:
    return bool(
        settings.TWILIO_ACCOUNT_SID
        and settings.TWILIO_AUTH_TOKEN
        and settings.TWILIO_VERIFY_SERVICE_SID
    )


def _base_url() -> str:
    sid = settings.TWILIO_VERIFY_SERVICE_SID
    return f"https://verify.twilio.com/v2/Services/{sid}"


async def send_code(phone_e164: str, channel: Channel = "sms") -> None:
    """
    Envía un código de verificación al teléfono (formato E.164: +5219991234567).
    channel: 'sms' o 'whatsapp'.
    """
    if not twilio_configured():
        raise RuntimeError("Twilio no está configurado.")

    auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    data = {"To": phone_e164, "Channel": channel}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{_base_url()}/Verifications", data=data, auth=auth)

    if resp.status_code not in (200, 201):
        logger.error("Twilio send_code error [%s]: %s", resp.status_code, resp.text)
        # Mensajes comunes: número inválido, canal no habilitado
        detail = "No se pudo enviar el código. Verifica el número."
        try:
            body = resp.json()
            if body.get("code") == 60200:
                detail = "El número de teléfono no es válido."
            elif body.get("code") == 60410:
                detail = "Este número está bloqueado temporalmente. Intenta más tarde."
        except Exception:
            pass
        raise ValueError(detail)

    logger.info("Código enviado a %s vía %s", phone_e164, channel)


async def check_code(phone_e164: str, code: str) -> bool:
    """Verifica el código ingresado por el usuario. Retorna True si es correcto."""
    if not twilio_configured():
        raise RuntimeError("Twilio no está configurado.")

    auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    data = {"To": phone_e164, "Code": code}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{_base_url()}/VerificationCheck", data=data, auth=auth)

    if resp.status_code not in (200, 201):
        logger.warning("Twilio check_code error [%s]: %s", resp.status_code, resp.text)
        return False

    body = resp.json()
    return body.get("status") == "approved"
