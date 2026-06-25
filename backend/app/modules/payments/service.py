"""
Integración con MercadoPago para Beel.

Flujo:
  1. Guest confirma reserva → create_checkout_preference()
     → se crea una Payment en BD con status='pending'
     → se retorna la URL de MP para redirigir al guest
  2. Guest paga en MP → MP llama nuestro webhook
     → handle_mp_webhook() actualiza el Payment
     → si aprobado: confirma la reserva, bloquea fechas
  3. 24 h después del check-in → release_payout() libera fondos al host

Nota: en MVP usamos el SDK de Python de MP. Las transferencias al host
son manuales en el Dashboard de MP hasta integrar payouts automáticos.
"""

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import mercadopago
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.modules.payments.models import Payment
from app.modules.reservations.models import Reservation
from app.modules.reservations.service import _block_dates
from app.modules.properties.models import Property
from app.modules.users.models import User

logger = logging.getLogger(__name__)

# Cliente de MercadoPago
_mp_sdk: Optional[mercadopago.SDK] = None


def _get_mp() -> mercadopago.SDK:
    global _mp_sdk
    if _mp_sdk is None:
        _mp_sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
    return _mp_sdk


# ── Crear preferencia de pago ─────────────────────────────────────────────────

async def create_checkout(
    db: AsyncSession,
    reservation: Reservation,
    back_urls: dict,
) -> Payment:
    """
    Crea una preferencia de pago en MercadoPago y registra el Payment en BD.

    back_urls: {
        "success": "https://beel.mx/reservaciones/{id}?pago=ok",
        "failure": "https://beel.mx/reservaciones/{id}?pago=error",
        "pending": "https://beel.mx/reservaciones/{id}?pago=pendiente",
    }
    """
    mp = _get_mp()

    host_payout = reservation.total_amount - reservation.platform_fee_snapshot
    nights = reservation.nights

    preference_data = {
        "items": [
            {
                "id": str(reservation.id),
                "title": f"Reserva en {reservation.reservation_property.title}",
                "description": (
                    f"{nights} {'noche' if nights == 1 else 'noches'} | "
                    f"{reservation.check_in} → {reservation.check_out}"
                ),
                "quantity": 1,
                "unit_price": float(reservation.total_amount),
                "currency_id": reservation.currency,
            }
        ],
        "payer": {
            "name": reservation.guest.full_name,
            "email": reservation.guest.email,
        },
        "back_urls": back_urls,
        "auto_return": "approved",
        "notification_url": f"{settings.BACKEND_URL}/api/v1/payments/webhook/mercadopago",
        "external_reference": str(reservation.id),
        "expires": False,
        "metadata": {
            "reservation_id": str(reservation.id),
            "guest_id": str(reservation.guest_id),
            "host_id": str(reservation.host_id),
            "beel_env": settings.ENVIRONMENT,
        },
    }

    response = mp.preference().create(preference_data)
    pref = response.get("response", {})

    if response.get("status") not in (200, 201):
        logger.error("Error al crear preferencia MP: %s", response)
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Error al iniciar el pago con MercadoPago")

    payment = Payment(
        reservation_id=reservation.id,
        mp_preference_id=pref.get("id"),
        amount=reservation.total_amount,
        currency=reservation.currency,
        platform_fee=reservation.platform_fee_snapshot,
        host_payout=host_payout,
        status="pending",
        mp_response=pref,
    )
    db.add(payment)
    await db.flush()
    logger.info("Preferencia MP creada: %s para reserva %s", pref.get("id"), reservation.id)
    return payment


async def get_checkout_urls(payment: Payment) -> dict:
    """Retorna las URLs de checkout desde la respuesta de MP."""
    pref = payment.mp_response or {}
    return {
        "payment_id": str(payment.id),
        "checkout_url": pref.get("init_point", ""),
        "sandbox_init_point": pref.get("sandbox_init_point", ""),
    }


# ── Webhook de MercadoPago ────────────────────────────────────────────────────

async def _is_duplicate_webhook(x_request_id: str) -> bool:
    """Verifica si un webhook ya fue procesado usando Redis."""
    if not x_request_id:
        return False
    try:
        from app.core.cache import get_cache
        redis = await get_cache()
        key = f"beel:webhook:mp:{x_request_id}"
        exists = await redis.set(key, "1", nx=True, ex=86400)
        return not exists
    except Exception:
        logger.warning("Redis no disponible para idempotencia de webhook MP")
        return False


def _verify_mp_signature(x_signature: str, x_request_id: str, data_id: str) -> bool:
    """
    Verifica la firma HMAC-SHA256 del webhook de MP según el spec oficial.
    El header x-signature viene como "ts=<unix>,v1=<hex>" y se firma el
    manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    Docs: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
    """
    if not settings.MERCADOPAGO_WEBHOOK_SECRET:
        logger.critical("MERCADOPAGO_WEBHOOK_SECRET no configurado — webhooks sin firma")
        return False

    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts, v1 = parts.get("ts", ""), parts.get("v1", "")
    if not ts or not v1:
        return False

    # MP: si el id es alfanumérico va en minúsculas (los de pago son numéricos).
    did = (data_id or "").lower()
    manifest = f"id:{did};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(
        settings.MERCADOPAGO_WEBHOOK_SECRET.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, v1)


async def handle_mp_webhook(
    db: AsyncSession,
    payload: dict,
    x_signature: str = "",
    x_request_id: str = "",
    data_id: str = "",
) -> str:
    """
    Procesa los eventos de webhook de MercadoPago.
    Retorna el estado resultante del pago.
    """
    # 1. Verificar firma HMAC (sobre el manifest id;request-id;ts)
    if not _verify_mp_signature(x_signature, x_request_id, data_id or str(payload.get("data", {}).get("id", ""))):
        logger.warning("Firma HMAC inválida en webhook MP: %s", x_request_id)
        raise ValueError("Invalid webhook signature")

    # 2. Idempotencia: evitar procesar webhooks duplicados
    if await _is_duplicate_webhook(x_request_id):
        logger.info("Webhook MP duplicado ignorado: %s", x_request_id)
        return "duplicate"

    # 3. Procesar el evento
    event_type = payload.get("type")
    data = payload.get("data", {})

    if event_type != "payment":
        logger.info("Webhook MP ignorado: tipo=%s", event_type)
        return "ignored"

    mp_payment_id = str(data.get("id", ""))
    if not mp_payment_id:
        return "no_id"

    # Obtener detalles del pago desde MP
    mp = _get_mp()
    response = mp.payment().get(mp_payment_id)
    mp_data = response.get("response", {})

    mp_status = mp_data.get("status", "")
    external_ref = mp_data.get("external_reference", "")
    payment_method = mp_data.get("payment_type_id", "")

    # Buscar el Payment por mp_preference_id o external_reference (reservation_id)
    try:
        reservation_id = uuid.UUID(external_ref)
    except (ValueError, AttributeError):
        logger.warning("external_reference inválido: %s", external_ref)
        return "invalid_ref"

    result = await db.execute(
        select(Payment).where(Payment.reservation_id == reservation_id)
        .order_by(Payment.created_at.desc())
    )
    payment = result.scalar_one_or_none()

    if not payment:
        logger.warning("Payment no encontrado para reserva %s", reservation_id)
        return "not_found"

    # Actualizar el Payment
    payment.mp_payment_id = mp_payment_id
    payment.payment_method = payment_method
    payment.mp_response = mp_data
    payment.status = mp_status

    if mp_status == "approved":
        amount_ok = await _verify_payment_amount(db, payment, mp_data)
        if not amount_ok:
            return "amount_mismatch"
        await _on_payment_approved(db, payment, reservation_id)

    elif mp_status in ("rejected", "cancelled"):
        payment.failure_reason = mp_data.get("status_detail", "")
        logger.info("Pago rechazado para reserva %s: %s", reservation_id, payment.failure_reason)

    await db.flush()
    return mp_status


async def _verify_payment_amount(
    db: AsyncSession, payment: Payment, mp_data: dict
) -> bool:
    """
    Verifica que el monto pagado en MP coincida con el de la reserva.
    Rechaza pagos por debajo del monto esperado.
    """
    mp_amount = Decimal(str(mp_data.get("transaction_amount", 0)))
    if mp_amount < payment.amount:
        logger.error(
            "Monto incorrecto en pago: MP=%s vs DB=%s para payment=%s",
            mp_amount, payment.amount, payment.id,
        )
        payment.status = "amount_mismatch"
        payment.failure_reason = f"Monto recibido ({mp_amount}) menor al esperado ({payment.amount})"
        await db.flush()
        return False
    return True


async def _on_payment_approved(
    db: AsyncSession, payment: Payment, reservation_id: uuid.UUID
) -> None:
    """
    Acciones post-pago aprobado:
    1. Confirmar la reserva (si aún está pending) con SELECT FOR UPDATE.
    2. Usar UPDATEs atómicos para contadores (previene double-counting).
    """
    from sqlalchemy import update

    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .with_for_update()
    )
    reservation = result.scalar_one_or_none()
    if not reservation:
        return

    if reservation.status == "pending":
        reservation.status = "confirmed"
        await _block_dates(
            db,
            reservation.property_id,
            reservation.check_in,
            reservation.check_out,
            reservation.id,
        )

        # UPDATEs atómicos para contadores
        await db.execute(
            update(Property)
            .where(Property.id == reservation.property_id)
            .values(total_bookings=Property.total_bookings + 1)
        )
        await db.execute(
            update(User)
            .where(User.id == reservation.guest_id)
            .values(total_trips=User.total_trips + 1)
        )
        logger.info("Reserva %s confirmada vía pago aprobado", reservation_id)

    payment.payout_status = "awaiting_beel_approval"
    await db.flush()


async def get_payment_by_reservation(
    db: AsyncSession, reservation_id: uuid.UUID
) -> Optional[Payment]:
    result = await db.execute(
        select(Payment)
        .where(Payment.reservation_id == reservation_id)
        .order_by(Payment.created_at.desc())
    )
    return result.scalar_one_or_none()


async def list_payments_for_admin(
    db: AsyncSession,
    payout_status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[Payment], int]:
    """
    Lista todos los pagos para el panel de administración.
    Incluye las relaciones de reserva, huésped, anfitrión y propiedad via selectin.
    """
    from app.modules.reservations.models import Reservation

    base_q = (
        select(Payment)
        .join(Reservation, Payment.reservation_id == Reservation.id)
        .options(selectinload(Payment.reservation))
    )
    if payout_status:
        base_q = base_q.where(Payment.payout_status == payout_status)

    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    result = await db.execute(
        base_q.order_by(Payment.created_at.desc()).limit(limit).offset(offset)
    )
    return result.scalars().all(), total


async def get_payment_by_id(
    db: AsyncSession, payment_id: uuid.UUID
) -> Optional[Payment]:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    return result.scalar_one_or_none()


# ── Aprobación de payout por admin de Beel ───────────────────────────────────

async def approve_payout(
    db: AsyncSession,
    payment: Payment,
    admin_user_id: str,
    notes: Optional[str] = None,
) -> Payment:
    """
    Marca el pago como aprobado para payout por el admin de Beel.
    El admin luego transfiere manualmente en el Dashboard de MercadoPago.
    """
    if payment.status != "approved":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden aprobar pagos con status 'approved' (actual: '{payment.status}')",
        )
    if payment.payout_status not in ("awaiting_beel_approval", "pending"):
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"El payout ya fue procesado (status: '{payment.payout_status}')",
        )

    payment.payout_status = "approved"
    payment.beel_approved_at = datetime.now(timezone.utc)
    payment.beel_approved_by = admin_user_id

    await db.flush()
    logger.info(
        "Payout aprobado por admin %s para payment %s (reserva %s)%s",
        admin_user_id,
        payment.id,
        payment.reservation_id,
        f" — {notes}" if notes else "",
    )
    return payment


# ── Reembolso al huésped ─────────────────────────────────────────────────────

async def issue_refund(
    db: AsyncSession,
    payment: Payment,
    reason: str,
) -> dict:
    """
    Emite un reembolso al huésped via MercadoPago y cancela la reserva.

    Solo aplicable si el pago fue aprobado por MP (hay fondos para devolver).
    El reembolso puede tardar 1-15 días hábiles según el método de pago del huésped.
    """
    if payment.status != "approved":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail=f"Solo se pueden reembolsar pagos aprobados (actual: '{payment.status}')",
        )
    if payment.payout_status == "refunded":
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Este pago ya fue reembolsado")
    if payment.payout_status == "completed":
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="No se puede reembolsar un pago que ya fue transferido al anfitrión",
        )
    if not payment.mp_payment_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="El pago no tiene ID de MercadoPago")

    # Emitir reembolso en MP
    mp = _get_mp()
    response = mp.payment().refund(payment.mp_payment_id)
    refund_data = response.get("response", {})

    if response.get("status") not in (200, 201):
        logger.error("Error al emitir reembolso MP: %s", response)
        from fastapi import HTTPException
        raise HTTPException(status_code=502, detail="Error al procesar el reembolso con MercadoPago")

    refund_id = str(refund_data.get("id", ""))
    refund_status = refund_data.get("status", "")

    # Actualizar el Payment
    payment.refund_id = refund_id
    payment.refunded_at = datetime.now(timezone.utc)
    payment.refund_reason = reason
    payment.payout_status = "refunded"

    # Cancelar la reserva y desbloquear fechas
    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == payment.reservation_id)
        .with_for_update()
    )
    reservation = result.scalar_one_or_none()
    if reservation and reservation.status == "confirmed":
        reservation.status = "cancelled_host"
        reservation.cancellation_reason = f"Reembolso emitido por Beel: {reason}"
        from app.modules.reservations.service import _unblock_dates
        await _unblock_dates(db, reservation.property_id, reservation.id)

    await db.flush()
    logger.info(
        "Reembolso emitido: refund_id=%s, payment=%s, reserva=%s, razón=%s",
        refund_id, payment.id, payment.reservation_id, reason,
    )
    return {
        "refund_id": refund_id,
        "status": refund_status,
        "amount": payment.amount,
    }
