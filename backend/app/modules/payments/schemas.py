"""Pydantic schemas para pagos."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class PaymentOut(BaseModel):
    id: uuid.UUID
    reservation_id: uuid.UUID
    mp_preference_id: Optional[str]
    mp_payment_id: Optional[str]
    amount: Decimal
    currency: str
    platform_fee: Decimal
    host_payout: Decimal
    status: str
    payment_method: Optional[str]
    payout_status: str
    payout_at: Optional[datetime]
    beel_approved_at: Optional[datetime]
    beel_approved_by: Optional[str]
    refund_id: Optional[str]
    refunded_at: Optional[datetime]
    refund_reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PayoutApproveIn(BaseModel):
    """Body para que el admin de Beel apruebe el payout al anfitrión."""
    notes: Optional[str] = None


class RefundIn(BaseModel):
    """Body para emitir un reembolso al huésped."""
    reason: str


class RefundOut(BaseModel):
    """Respuesta tras emitir un reembolso."""
    refund_id: str
    status: str
    amount: Decimal


class CheckoutOut(BaseModel):
    """Respuesta al iniciar un pago — incluye la URL de MP para redirigir."""
    payment_id: uuid.UUID
    checkout_url: str          # URL de MercadoPago (sandbox o producción)
    sandbox_init_point: str    # Solo en testing


class WebhookEventIn(BaseModel):
    """Payload del webhook de MercadoPago."""
    id: Optional[int] = None
    type: Optional[str] = None   # "payment", "merchant_order"
    action: Optional[str] = None
    data: Optional[dict] = None
    live_mode: Optional[bool] = None
