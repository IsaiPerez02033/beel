"""
Servicio de email para Beel usando SendGrid.

Uso:
    from app.core.email import send_reservation_confirmed_guest
    await send_reservation_confirmed_guest(reservation)

Falla silenciosamente — nunca interrumpe el flujo de negocio.
"""

import asyncio
import logging
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from app.core.config import settings

if TYPE_CHECKING:
    from app.modules.reservations.models import Reservation

logger = logging.getLogger(__name__)


# ── Cliente SendGrid (lazy init) ─────────────────────────────────────────────

_sg_client = None


def _get_client():
    global _sg_client
    if _sg_client is not None:
        return _sg_client
    if not settings.EMAIL_API_KEY:
        return None
    try:
        import sendgrid
        _sg_client = sendgrid.SendGridAPIClient(api_key=settings.EMAIL_API_KEY)
        return _sg_client
    except Exception as e:
        logger.warning("SendGrid no disponible: %s", e)
        return None


async def _send(to_email: str, to_name: str, subject: str, html: str) -> None:
    """Envía un email via SendGrid de forma async (fire-and-forget)."""
    if not settings.EMAIL_API_KEY:
        logger.info("EMAIL_API_KEY no configurado — email no enviado a %s: %s", to_email, subject)
        return

    def _do_send():
        try:
            from sendgrid.helpers.mail import Mail, Email, To, Content
            client = _get_client()
            if not client:
                return
            message = Mail(
                from_email=Email(settings.EMAIL_FROM_ADDRESS, settings.EMAIL_FROM_NAME),
                to_emails=To(to_email, to_name),
                subject=subject,
                html_content=Content("text/html", html),
            )
            response = client.send(message)
            logger.info("Email enviado a %s [%s] → %s", to_email, subject, response.status_code)
        except Exception as e:
            logger.error("Error enviando email a %s: %s", to_email, e)

    # Ejecutar en thread pool para no bloquear el event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _do_send)


# ── Helpers de formato ────────────────────────────────────────────────────────

def _fmt_date(d: date) -> str:
    MESES = ["ene", "feb", "mar", "abr", "may", "jun",
             "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{d.day} {MESES[d.month - 1]} {d.year}"


def _fmt_price(amount: Decimal | float) -> str:
    return f"${float(amount):,.0f} MXN"


# ── Templates HTML ────────────────────────────────────────────────────────────

_BASE = """
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#F1EFE8;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFE8;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo -->
        <tr><td style="padding-bottom:24px;text-align:center;">
          <span style="font-size:28px;font-weight:600;color:#147A5C;letter-spacing:-1px;">beel</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#FFFFFF;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
          {body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9C9A96;">
            © 2025 Beel · México<br>
            <a href="https://beel.mx" style="color:#147A5C;text-decoration:none;">beel.mx</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""

_BADGE_GREEN = "display:inline-block;background:#E8F5F0;color:#147A5C;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500;"
_BADGE_AMBER = "display:inline-block;background:#FEF3CD;color:#92610A;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:500;"
_H1 = "margin:0 0 8px;font-size:22px;font-weight:600;color:#2C2C2A;"
_P = "margin:0 0 16px;font-size:15px;color:#5C5A57;line-height:1.6;"
_DIVIDER = "<hr style='border:none;border-top:1px solid #EBEBEB;margin:24px 0;'>"
_ROW = "<tr><td style='padding:6px 0;font-size:14px;color:#9C9A96;width:130px;'>{label}</td><td style='padding:6px 0;font-size:14px;color:#2C2C2A;font-weight:500;'>{value}</td></tr>"
_BTN = "<a href='{url}' style='display:inline-block;background:#147A5C;color:#FFFFFF;padding:12px 28px;border-radius:10px;font-size:15px;font-weight:500;text-decoration:none;'>{text}</a>"


def _detail_table(*rows: tuple[str, str]) -> str:
    inner = "".join(_ROW.format(label=r[0], value=r[1]) for r in rows)
    return f"<table width='100%' cellpadding='0' cellspacing='0' style='background:#F8F7F4;border-radius:10px;padding:16px 20px;margin-bottom:24px;'><tbody>{inner}</tbody></table>"


# ── Emails de reserva ─────────────────────────────────────────────────────────

def _build_confirmation_guest(
    guest_name: str,
    property_title: str,
    check_in: date,
    check_out: date,
    nights: int,
    total: Decimal,
    reservation_id: str,
) -> str:
    frontend = settings.FRONTEND_URL or "https://beel.mx"
    body = f"""
      <p style="{_BADGE_GREEN}">✓ Reserva confirmada</p>
      <h1 style="{_H1};margin-top:16px;">¡Tu estancia está lista, {guest_name.split()[0]}!</h1>
      <p style="{_P}">Tu reserva en <strong>{property_title}</strong> ha sido confirmada. Aquí están los detalles:</p>

      {_detail_table(
        ("Propiedad", property_title),
        ("Check-in", _fmt_date(check_in)),
        ("Check-out", _fmt_date(check_out)),
        ("Noches", str(nights)),
        ("Total pagado", _fmt_price(total)),
      )}

      {_DIVIDER}
      <p style="{_P};margin-bottom:24px;">El anfitrión te contactará para los detalles de llegada. Si tienes preguntas, escríbele desde la plataforma.</p>
      <p style="margin:0;">{_BTN.format(url=f"{frontend}/reservaciones/{reservation_id}", text="Ver mi reserva")}</p>
    """
    return _BASE.format(title="Reserva confirmada — Beel", body=body)


def _build_new_request_host(
    host_name: str,
    guest_name: str,
    property_title: str,
    check_in: date,
    check_out: date,
    nights: int,
    guests_count: int,
    guest_message: str | None,
    reservation_id: str,
) -> str:
    frontend = settings.FRONTEND_URL or "https://beel.mx"
    msg_block = f"""
      {_DIVIDER}
      <p style="margin:0 0 4px;font-size:13px;color:#9C9A96;font-weight:500;">Mensaje del huésped</p>
      <p style="margin:0;font-size:14px;color:#2C2C2A;font-style:italic;">"{guest_message}"</p>
    """ if guest_message else ""

    body = f"""
      <p style="{_BADGE_AMBER}">⏳ Nueva solicitud de reserva</p>
      <h1 style="{_H1};margin-top:16px;">Hola {host_name.split()[0]}, tienes una nueva solicitud</h1>
      <p style="{_P}"><strong>{guest_name}</strong> quiere hospedarse en <strong>{property_title}</strong>. Tienes 24 horas para responder.</p>

      {_detail_table(
        ("Propiedad", property_title),
        ("Huésped", guest_name),
        ("Check-in", _fmt_date(check_in)),
        ("Check-out", _fmt_date(check_out)),
        ("Noches", str(nights)),
        ("Huéspedes", str(guests_count)),
      )}

      {msg_block}

      {_DIVIDER}
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;">{_BTN.format(url=f"{frontend}/anfitrion", text="Aceptar o rechazar")}</td>
      </tr></table>
    """
    return _BASE.format(title="Nueva solicitud de reserva — Beel", body=body)


def _build_host_accepted_guest(
    guest_name: str,
    property_title: str,
    check_in: date,
    check_out: date,
    nights: int,
    total: Decimal,
    reservation_id: str,
) -> str:
    frontend = settings.FRONTEND_URL or "https://beel.mx"
    body = f"""
      <p style="{_BADGE_GREEN}">✓ Solicitud aceptada</p>
      <h1 style="{_H1};margin-top:16px;">¡El anfitrión aceptó tu solicitud!</h1>
      <p style="{_P}">Tu solicitud para <strong>{property_title}</strong> fue aceptada. Ya puedes proceder con el pago para confirmar tu lugar.</p>

      {_detail_table(
        ("Propiedad", property_title),
        ("Check-in", _fmt_date(check_in)),
        ("Check-out", _fmt_date(check_out)),
        ("Noches", str(nights)),
        ("Total", _fmt_price(total)),
      )}

      {_DIVIDER}
      <p style="{_P};margin-bottom:24px;">Completa tu pago para asegurar la reserva. Si no pagas en las próximas horas, la reserva puede cancelarse.</p>
      <p style="margin:0;">{_BTN.format(url=f"{frontend}/reservaciones/{reservation_id}", text="Completar pago")}</p>
    """
    return _BASE.format(title="¡Tu solicitud fue aceptada! — Beel", body=body)


def _build_host_confirmed_host(
    host_name: str,
    guest_name: str,
    property_title: str,
    check_in: date,
    check_out: date,
    nights: int,
    total: Decimal,
    reservation_id: str,
) -> str:
    frontend = settings.FRONTEND_URL or "https://beel.mx"
    body = f"""
      <p style="{_BADGE_GREEN}">✓ Reserva confirmada</p>
      <h1 style="{_H1};margin-top:16px;">Confirmaste la reserva de {guest_name.split()[0]}</h1>
      <p style="{_P}">La reserva queda confirmada. El pago está en proceso y será liberado a tu cuenta una vez que la estancia se complete exitosamente.</p>

      {_detail_table(
        ("Propiedad", property_title),
        ("Huésped", guest_name),
        ("Check-in", _fmt_date(check_in)),
        ("Check-out", _fmt_date(check_out)),
        ("Noches", str(nights)),
        ("Monto a recibir", _fmt_price(total)),
      )}

      {_DIVIDER}
      <p style="margin:0;">{_BTN.format(url=f"{frontend}/anfitrion", text="Ver mis reservas")}</p>
    """
    return _BASE.format(title="Reserva confirmada — Beel", body=body)


# ── Funciones públicas ────────────────────────────────────────────────────────

async def send_reservation_confirmed_guest(reservation: "Reservation") -> None:
    """Huésped: reserva confirmada (instant booking o aceptada por anfitrión)."""
    try:
        html = _build_confirmation_guest(
            guest_name=reservation.guest.full_name,
            property_title=reservation.reservation_property.title,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            nights=reservation.nights,
            total=reservation.total_amount,
            reservation_id=str(reservation.id),
        )
        await _send(
            to_email=reservation.guest.email,
            to_name=reservation.guest.full_name,
            subject=f"✓ Reserva confirmada — {reservation.reservation_property.title}",
            html=html,
        )
    except Exception as e:
        logger.error("send_reservation_confirmed_guest falló: %s", e)


async def send_new_request_host(reservation: "Reservation") -> None:
    """Anfitrión: nueva solicitud de reserva pendiente."""
    try:
        html = _build_new_request_host(
            host_name=reservation.host.full_name,
            guest_name=reservation.guest.full_name,
            property_title=reservation.reservation_property.title,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            nights=reservation.nights,
            guests_count=reservation.guests_count,
            guest_message=reservation.guest_message,
            reservation_id=str(reservation.id),
        )
        await _send(
            to_email=reservation.host.email,
            to_name=reservation.host.full_name,
            subject=f"Nueva solicitud de {reservation.guest.full_name} — {reservation.reservation_property.title}",
            html=html,
        )
    except Exception as e:
        logger.error("send_new_request_host falló: %s", e)


async def send_host_accepted_guest(reservation: "Reservation") -> None:
    """Huésped: el anfitrión aceptó su solicitud pendiente."""
    try:
        html = _build_host_accepted_guest(
            guest_name=reservation.guest.full_name,
            property_title=reservation.reservation_property.title,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            nights=reservation.nights,
            total=reservation.total_amount,
            reservation_id=str(reservation.id),
        )
        await _send(
            to_email=reservation.guest.email,
            to_name=reservation.guest.full_name,
            subject=f"¡Tu solicitud fue aceptada! — {reservation.reservation_property.title}",
            html=html,
        )
    except Exception as e:
        logger.error("send_host_accepted_guest falló: %s", e)


async def send_reservation_confirmed_host(reservation: "Reservation") -> None:
    """Anfitrión: confirmó una reserva (notificación de resumen)."""
    try:
        html = _build_host_confirmed_host(
            host_name=reservation.host.full_name,
            guest_name=reservation.guest.full_name,
            property_title=reservation.reservation_property.title,
            check_in=reservation.check_in,
            check_out=reservation.check_out,
            nights=reservation.nights,
            total=reservation.total_amount,
            reservation_id=str(reservation.id),
        )
        await _send(
            to_email=reservation.host.email,
            to_name=reservation.host.full_name,
            subject=f"Reserva confirmada — {reservation.guest.full_name} en {reservation.reservation_property.title}",
            html=html,
        )
    except Exception as e:
        logger.error("send_reservation_confirmed_host falló: %s", e)
