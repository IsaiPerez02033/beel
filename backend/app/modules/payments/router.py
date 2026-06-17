"""Router de pagos con MercadoPago."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.config import settings
from app.core.database import get_db
from app.modules.payments import service as payment_service
from app.modules.payments.schemas import CheckoutOut, PaymentOut, WebhookEventIn
from app.modules.reservations import service as reservation_service
from app.modules.users import service as user_service
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/checkout/{reservation_id}", response_model=CheckoutOut)
@limiter.limit("3/minute")
async def create_checkout(
    reservation_id: uuid.UUID,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Inicia el proceso de pago para una reserva confirmada.
    Retorna la URL de MercadoPago a la que redirigir al usuario.
    """
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reservation = await reservation_service.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reservation.guest_id != user.id:
        raise HTTPException(status_code=403, detail="Solo el huésped puede iniciar el pago")

    if reservation.status not in ("confirmed", "pending"):
        raise HTTPException(
            status_code=400,
            detail=f"La reserva en estado '{reservation.status}' no admite pagos",
        )

    # Verificar que no haya ya un pago aprobado
    existing = await payment_service.get_payment_by_reservation(db, reservation_id)
    if existing and existing.status == "approved":
        raise HTTPException(status_code=400, detail="Esta reserva ya fue pagada")

    # URLs de retorno
    frontend = settings.FRONTEND_URL or settings.ALLOWED_ORIGINS[-1]
    back_urls = {
        "success": f"{frontend}/reservaciones/{reservation_id}?pago=ok",
        "failure": f"{frontend}/reservaciones/{reservation_id}?pago=error",
        "pending": f"{frontend}/reservaciones/{reservation_id}?pago=pendiente",
    }

    payment = await payment_service.create_checkout(db, reservation, back_urls)
    urls = await payment_service.get_checkout_urls(payment)
    return CheckoutOut(**urls)


@router.get("/{reservation_id}", response_model=PaymentOut)
async def get_payment(
    reservation_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el estado del pago de una reserva."""
    user = await user_service.get_user_by_clerk_id(db, current_user.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    reservation = await reservation_service.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    if reservation.guest_id != user.id and reservation.host_id != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    payment = await payment_service.get_payment_by_reservation(db, reservation_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    return payment


@router.post("/webhook/mercadopago", status_code=status.HTTP_200_OK)
async def mp_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint de notificaciones de MercadoPago.
    MP reintenta si no recibe 200 en 5 segundos.
    """
    body = await request.body()
    x_signature = request.headers.get("x-signature", "")
    x_request_id = request.headers.get("x-request-id", "")

    try:
        import json
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido")

    try:
        result = await payment_service.handle_mp_webhook(
            db, payload, x_signature, x_request_id
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Firma de webhook inválida")
    logger.info("Webhook MP procesado: %s", result)
    return {"status": result}
