"""Router de usuarios."""

import uuid
import logging

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.modules.users import service
from app.modules.users.schemas import (
    BecomeHostIn,
    PhoneSendIn,
    PhoneVerifyIn,
    UserGoogleIn,
    UserLoginIn,
    HostProfileOut,
    HostReviewOut,
    UserMeOut,
    UserPublicOut,
    UserRegisterIn,
    UserUpdateIn,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── NextAuth — endpoints públicos ──────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(
    data: UserRegisterIn,
    db: AsyncSession = Depends(get_db),
):
    """Registro con email y contraseña."""
    user = await service.create_user_credentials(
        db, data.email, data.password, data.full_name
    )
    await db.commit()
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name}


@router.get("/check-email")
async def check_email(
    email: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Verifica si un email ya está registrado y con qué proveedor.
    Usado por el frontend para redirigir entre registro e inicio de sesión.
    """
    user = await service.get_user_by_email(db, email)
    if not user:
        return {"exists": False, "provider": None}
    return {"exists": True, "provider": user.provider}


@router.post("/login")
async def login(
    data: UserLoginIn,
    db: AsyncSession = Depends(get_db),
):
    """Login con email y contraseña (llamado por NextAuth internamente)."""
    user = await service.get_user_by_email(db, data.email)
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not await service.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


@router.post("/oauth/google")
async def oauth_google(
    data: UserGoogleIn,
    db: AsyncSession = Depends(get_db),
):
    """Registro/login con Google OAuth."""
    user = await service.get_or_create_google_user(
        db, data.email, data.full_name, data.google_id, data.avatar_url
    )
    await db.commit()
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
    }


# ── Endpoints autenticados ─────────────────────────────────────────────────────


@router.get("/me", response_model=UserMeOut)
async def get_me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el perfil completo del usuario autenticado."""
    import uuid as uuid_mod
    user_id = current_user.id
    user = await service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado. Asegúrate de completar el registro.",
        )
    return user


@router.patch("/me", response_model=UserMeOut)
async def update_me(
    request: Request,
    data: UserUpdateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Actualiza el perfil del usuario autenticado."""
    user_id = current_user.id
    user = await service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Si está actualizando la CLABE, guardar auditoría y enviar email
    new_clabe = getattr(data, "bank_clabe", None)
    clabe_changed = new_clabe and new_clabe != user.bank_clabe
    if clabe_changed:
        from datetime import datetime, timezone
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        user.bank_clabe_set_at = datetime.now(timezone.utc)
        user.bank_clabe_set_ip = client_ip.split(",")[0].strip()[:45]

    updated = await service.update_user(db, user, data)

    # Email de confirmación al registrar CLABE
    if clabe_changed and updated.email and new_clabe:
        try:
            from app.core.email import _send
            last4 = new_clabe[-4:]
            import asyncio
            asyncio.ensure_future(_send(
                to_email=updated.email,
                to_name=updated.full_name,
                subject="Cuenta bancaria registrada en Beel",
                html=f"""
                <div style="font-family:Arial,sans-serif;padding:32px;background:#F1EFE8;">
                  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
                    <h2 style="color:#147A5C;margin:0 0 16px;">Cuenta bancaria registrada</h2>
                    <p style="color:#5C5A57;font-size:15px;line-height:1.6;margin:0 0 16px;">
                      Hola <strong>{updated.full_name}</strong>, registraste una cuenta bancaria en Beel:
                    </p>
                    <div style="background:#F8F7F4;border-radius:10px;padding:16px;margin-bottom:16px;">
                      <p style="margin:0 0 6px;font-size:13px;color:#9C9A96;">Titular</p>
                      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#2C2C2A;">{updated.bank_account_holder or updated.full_name}</p>
                      <p style="margin:0 0 6px;font-size:13px;color:#9C9A96;">Banco</p>
                      <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#2C2C2A;">{updated.bank_name or "No especificado"}</p>
                      <p style="margin:0 0 6px;font-size:13px;color:#9C9A96;">CLABE (últimos 4 dígitos)</p>
                      <p style="margin:0;font-size:18px;font-weight:700;color:#147A5C;font-family:monospace;">••• ••• ••• ••• {last4}</p>
                    </div>
                    <p style="color:#5C5A57;font-size:14px;line-height:1.6;margin:0 0 8px;">
                      Fecha: <strong>{user.bank_clabe_set_at.strftime('%d/%m/%Y %H:%M') if user.bank_clabe_set_at else 'ahora'} UTC</strong>
                    </p>
                    <div style="background:#FEF3CD;border-radius:10px;padding:12px;margin-top:16px;">
                      <p style="margin:0;font-size:13px;color:#92610A;">
                        ⚠️ Si <strong>no fuiste tú</strong> quien registró esta cuenta, contáctanos de inmediato a <a href="mailto:mexicobeel@gmail.com" style="color:#92610A;">mexicobeel@gmail.com</a>
                      </p>
                    </div>
                  </div>
                </div>
                """,
            ))
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Error enviando email CLABE: %s", e)

    return updated


@router.post("/me/avatar", response_model=UserMeOut)
async def upload_avatar(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Sube una foto de perfil del usuario a S3 y actualiza avatar_url."""
    from app.core.storage import upload_photo as s3_upload, s3_configured, ALLOWED_CONTENT_TYPES

    user = await service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not s3_configured():
        raise HTTPException(status_code=503, detail="El almacenamiento de fotos no está configurado.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPEG, PNG o WebP.")

    file_bytes = await file.read()
    try:
        url, _ = await s3_upload(
            file_bytes=file_bytes,
            content_type=content_type,
            prefix=f"avatars/{user.id}",
        )
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    user.avatar_url = url
    await db.flush()
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/become-host", response_model=UserMeOut)
async def become_host(
    data: BecomeHostIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Convierte al usuario en anfitrión. Requiere teléfono e identidad verificados."""
    from app.core.auth import require_full_verified

    user_id = current_user.id
    user = await service.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    require_full_verified(user)
    updated = await service.become_host(db, user)
    return updated


# ── Verificación de teléfono (Twilio Verify) ───────────────────────────────────

@router.post("/me/phone/send")
async def phone_send_code(
    data: PhoneSendIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Envía un código de verificación al teléfono por SMS o WhatsApp."""
    from app.core.sms import send_code, twilio_configured

    user = await service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not twilio_configured():
        raise HTTPException(status_code=503, detail="La verificación por teléfono no está configurada.")

    # Construir E.164 robusto:
    # - Si el usuario ya incluyó el "+" (número completo), usarlo tal cual.
    # - Si no, anteponer el código de país.
    raw = data.phone.strip()
    if raw.startswith("+"):
        digits = "".join(c for c in raw if c.isdigit())
        phone_e164 = f"+{digits}"
        cc = ""
        local = digits
    else:
        local = "".join(c for c in raw if c.isdigit())
        cc = data.country_code if data.country_code.startswith("+") else f"+{data.country_code}"
        cc_digits = "".join(c for c in cc if c.isdigit())
        # Evitar doble código de país si el número local ya lo incluye
        if cc_digits and local.startswith(cc_digits):
            phone_e164 = f"+{local}"
        else:
            phone_e164 = f"{cc}{local}"

    try:
        await send_code(phone_e164, data.channel)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Guardar el E.164 completo para que la verificación use exactamente el mismo número
    user.phone = phone_e164          # formato +525645915734
    user.phone_country_code = "+"    # marcador: el phone ya incluye el +
    await db.commit()
    return {"sent": True, "channel": data.channel, "to": phone_e164}


@router.post("/me/phone/verify", response_model=UserMeOut)
async def phone_verify_code(
    data: PhoneVerifyIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Verifica el código del teléfono. Si es correcto, marca el teléfono como verificado."""
    from datetime import datetime, timezone
    from app.core.sms import check_code

    user = await service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not user.phone:
        raise HTTPException(status_code=400, detail="Primero solicita un código de verificación.")

    # user.phone se guardó como E.164 completo (+525...). Usarlo tal cual.
    phone_e164 = user.phone if user.phone.startswith("+") else f"{user.phone_country_code}{user.phone}"
    ok = await check_code(phone_e164, data.code)
    if not ok:
        raise HTTPException(status_code=400, detail="Código incorrecto o expirado.")

    user.is_phone_verified = True
    user.phone_verified_at = datetime.now(timezone.utc)
    await service.maybe_promote_to_host(db, user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Verificación de identidad (Didit KYC) ──────────────────────────────────────

@router.post("/me/identity/start")
async def identity_start(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Inicia una sesión de verificación de identidad. Retorna la URL de Didit."""
    from app.core.identity import create_session, didit_configured

    user = await service.get_user_by_id(db, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if not didit_configured():
        raise HTTPException(status_code=503, detail="La verificación de identidad no está configurada.")

    frontend = settings.FRONTEND_URL or (settings.ALLOWED_ORIGINS[-1] if settings.ALLOWED_ORIGINS else "")
    callback_url = f"{frontend}/anfitrion/configuracion?identidad=ok"

    try:
        result = await create_session(str(user.id), callback_url)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    user.identity_session_id = result["session_id"]
    user.identity_status = "pending"
    await db.commit()
    return {"url": result["url"], "session_id": result["session_id"]}


@router.post("/identity/webhook")
async def identity_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook de Didit v3 — resultado de la verificación de identidad.
    Verifica firma (X-Signature-V2/X-Signature/Simple) y timestamp antes de procesar.
    Responde 2xx rápido e idempotente.
    """
    from datetime import datetime, timezone
    import json as _json
    from app.core.identity import verify_webhook, parse_webhook_result
    from app.core.config import settings as s

    body = await request.body()

    # 1. Verificar firma + timestamp (solo si hay secret configurado)
    if s.DIDIT_WEBHOOK_SECRET:
        ok, reason = verify_webhook(body, dict(request.headers))
        if not ok:
            logger.warning("Webhook Didit rechazado (%s). Body: %s", reason, body[:300])
            raise HTTPException(status_code=401, detail="Firma de webhook inválida")

    # 2. Parsear
    try:
        payload = _json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="JSON inválido")

    webhook_type = payload.get("webhook_type", "")
    # Solo nos interesan los cambios de estado de sesión
    if webhook_type and webhook_type not in ("status.updated", "user.status.updated"):
        return {"received": True, "ignored": webhook_type}

    user_id, status = parse_webhook_result(payload)
    if not user_id:
        return {"received": True, "note": "sin vendor_data"}

    try:
        user = await service.get_user_by_id(db, uuid.UUID(user_id))
    except (ValueError, TypeError):
        return {"received": True, "note": "vendor_data inválido"}

    if user:
        # Idempotente: si ya está aprobado, no reprocesar
        if not (user.is_identity_verified and status == "approved"):
            user.identity_status = status
            if status == "approved":
                user.is_identity_verified = True
                user.identity_verified_at = datetime.now(timezone.utc)
                await service.maybe_promote_to_host(db, user)
            await db.commit()
        logger.info("Identidad '%s' (%s) para usuario %s", status, webhook_type or "?", user_id)

    return {"received": True, "status": status}


@router.get("/{user_id}", response_model=UserPublicOut)
async def get_user_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retorna el perfil público de un usuario."""
    user = await service.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.get("/{user_id}/host-profile", response_model=HostProfileOut)
async def get_host_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Perfil público de anfitrión: métricas, propiedades activas y reseñas."""
    from sqlalchemy import select, func
    from sqlalchemy.orm import selectinload
    from app.modules.properties.models import Property, PropertyAmenity
    from app.modules.properties.schemas import PropertyCardOut
    from app.modules.reviews.models import Review

    user = await service.get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Anfitrión no encontrado")

    # Propiedades activas del anfitrión
    props_q = (
        select(Property)
        .options(
            selectinload(Property.host),
            selectinload(Property.photos),
            selectinload(Property.amenities).selectinload(PropertyAmenity.amenity),
        )
        .where(
            Property.host_id == user_id,
            Property.status == "active",
            Property.deleted_at.is_(None),
        )
        .order_by(Property.created_at.desc())
    )
    properties = list((await db.execute(props_q)).scalars().all())

    # Reseñas de huéspedes sobre las propiedades del anfitrión
    rev_q = (
        select(Review)
        .options(selectinload(Review.reviewer))
        .join(Property, Review.property_id == Property.id)
        .where(
            Property.host_id == user_id,
            Review.review_type == "guest_to_host",
            Review.is_published.is_(True),
        )
        .order_by(Review.created_at.desc())
        .limit(12)
    )
    reviews = list((await db.execute(rev_q)).scalars().all())

    agg_q = (
        select(func.avg(Review.overall_rating), func.count(Review.id))
        .join(Property, Review.property_id == Property.id)
        .where(
            Property.host_id == user_id,
            Review.review_type == "guest_to_host",
            Review.is_published.is_(True),
        )
    )
    avg_rating, total_reviews = (await db.execute(agg_q)).one()

    prop_titles = {p.id: p.title for p in properties}
    review_out = [
        HostReviewOut(
            id=r.id,
            reviewer_name=r.reviewer.full_name if r.reviewer else "Huésped",
            reviewer_avatar=r.reviewer.avatar_url if r.reviewer else None,
            overall_rating=r.overall_rating,
            comment=r.comment,
            property_title=prop_titles.get(r.property_id),
            created_at=r.created_at,
        )
        for r in reviews
    ]

    return HostProfileOut(
        id=user.id,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        is_identity_verified=user.is_identity_verified,
        role=user.role,
        host_since=user.host_since,
        created_at=user.created_at,
        total_listings=len(properties),
        avg_rating=float(avg_rating) if avg_rating is not None else None,
        total_reviews=total_reviews or 0,
        properties=[PropertyCardOut.model_validate(p) for p in properties],
        reviews=review_out,
    )
