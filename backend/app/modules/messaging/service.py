"""Lógica de negocio para mensajería."""

import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.modules.messaging.models import Conversation, Message, MessageReaction
from app.modules.messaging.schemas import ConversationStartIn, MessageCreateIn
from app.modules.users.models import User
from app.modules.properties.models import Property
from app.modules.reservations.models import Reservation

logger = logging.getLogger(__name__)

# ── Tiempo real: cola de eventos por conversación ─────────────────────────────
# Dict[conversation_id → List[(asyncio.Queue, user_id)]]
# Cada conexión WS activa tiene su propia Queue; el user_id permite saber si un
# usuario está viendo el chat (para no mandarle push redundante).
_sse_listeners: dict[uuid.UUID, list[tuple[asyncio.Queue, Optional[uuid.UUID]]]] = {}


def _register_listener(
    conversation_id: uuid.UUID, user_id: Optional[uuid.UUID] = None
) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_listeners.setdefault(conversation_id, []).append((q, user_id))
    return q


def _unregister_listener(conversation_id: uuid.UUID, q: asyncio.Queue) -> None:
    listeners = _sse_listeners.get(conversation_id, [])
    _sse_listeners[conversation_id] = [item for item in listeners if item[0] is not q]
    if not _sse_listeners.get(conversation_id):
        _sse_listeners.pop(conversation_id, None)


def user_is_connected(conversation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    """True si el usuario tiene una conexión en vivo a esta conversación."""
    return any(uid == user_id for _, uid in _sse_listeners.get(conversation_id, []))


async def _broadcast(conversation_id: uuid.UUID, event: dict) -> None:
    """Envía un evento a todas las colas activas de la conversación."""
    for q, _uid in _sse_listeners.get(conversation_id, []):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            logger.warning("SSE queue llena para conversación %s", conversation_id)


# ── Conversaciones ────────────────────────────────────────────────────────────

def _conv_query():
    return select(Conversation).options(
        selectinload(Conversation.guest),
        selectinload(Conversation.host),
    )


async def get_or_create_conversation(
    db: AsyncSession,
    guest_id: uuid.UUID,
    host_id: uuid.UUID,
    property_id: Optional[uuid.UUID] = None,
    reservation_id: Optional[uuid.UUID] = None,
) -> tuple[Conversation, bool]:
    """Retorna la conversación existente o crea una nueva. (conv, created)"""
    result = await db.execute(
        _conv_query().where(
            Conversation.guest_id == guest_id,
            Conversation.host_id == host_id,
            Conversation.property_id == property_id,
        )
    )
    conv = result.scalar_one_or_none()
    if conv:
        # Si la conversación existente no tenía reserva y ahora se pasa una, vincularla
        if reservation_id and not conv.reservation_id:
            conv.reservation_id = reservation_id
            await db.flush()
        return conv, False

    conv = Conversation(
        guest_id=guest_id,
        host_id=host_id,
        property_id=property_id,
        reservation_id=reservation_id,
    )
    db.add(conv)
    await db.flush()
    logger.info("Conversación creada: %s (guest=%s, host=%s)", conv.id, guest_id, host_id)
    return conv, True


async def get_conversation(
    db: AsyncSession, conversation_id: uuid.UUID
) -> Optional[Conversation]:
    # 1. Buscar por ID de conversación
    result = await db.execute(
        _conv_query().where(Conversation.id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if conv:
        return conv

    # 2. Si no se encuentra, buscar por ID de reserva
    result = await db.execute(
        _conv_query().where(Conversation.reservation_id == conversation_id)
    )
    conv = result.scalar_one_or_none()
    if conv:
        return conv

    # 3. Autocreación para reservas existentes (legacy)
    try:
        res_stmt = select(Reservation).where(Reservation.id == conversation_id)
        res_result = await db.execute(res_stmt)
        reservation = res_result.scalar_one_or_none()
        
        if reservation:
            # Buscar si ya existe una conversación sin reserva asociada para este guest-host-propiedad
            existing_stmt = select(Conversation).where(
                Conversation.guest_id == reservation.guest_id,
                Conversation.host_id == reservation.host_id,
                Conversation.property_id == reservation.property_id,
                Conversation.reservation_id.is_(None)
            )
            existing_result = await db.execute(existing_stmt)
            conv = existing_result.scalar_one_or_none()

            if conv:
                # Si existe, vincular la reservación
                conv.reservation_id = reservation.id
                await db.flush()
                await db.commit()
                logger.info("Conversación pre-existente vinculada a reserva legacy: %s (id: %s)", reservation.id, conv.id)
            else:
                # Si no, crear una nueva conversación
                conv = Conversation(
                    guest_id=reservation.guest_id,
                    host_id=reservation.host_id,
                    property_id=reservation.property_id,
                    reservation_id=reservation.id,
                )
                db.add(conv)
                await db.flush()
                
                msg_text = "Nueva solicitud de reserva creada."
                if reservation.status == "confirmed":
                    msg_text = "Reserva confirmada."
                await send_system_message(db, conv, msg_text)
                await db.commit()
                logger.info("Conversación autocreada para reserva legacy: %s (id: %s)", reservation.id, conv.id)
            
            # Re-consultar usando _conv_query para pre-cargar relaciones y evitar Greenlet errors
            result = await db.execute(
                _conv_query().where(Conversation.id == conv.id)
            )
            return result.scalar_one_or_none()
    except Exception as e:
        logger.exception("Error al autocrear/vincular conversación en get_conversation: %s", e)

    return None


async def list_conversations(
    db: AsyncSession, user_id: uuid.UUID
) -> list[Conversation]:
    """Lista las conversaciones de un usuario (como guest o host), más recientes primero."""
    result = await db.execute(
        _conv_query()
        .where(
            or_(Conversation.guest_id == user_id, Conversation.host_id == user_id),
            Conversation.is_archived.is_(False),
        )
        .order_by(Conversation.last_message_at.desc().nullslast())
    )
    return list(result.scalars().all())


async def start_conversation(
    db: AsyncSession, guest: User, data: ConversationStartIn
) -> tuple[Conversation, Message]:
    """Inicia una conversación con un primer mensaje, validando datos."""
    # Validar que el host existe y tiene rol host
    host = await db.get(User, data.host_id)
    if not host or host.role != "host":
        raise HTTPException(status_code=404, detail="Anfitrión no encontrado")

    # Validar que la propiedad existe y pertenece al host
    if data.property_id:
        property_ = await db.get(Property, data.property_id)
        if not property_:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")
        if property_.host_id != host.id:
            raise HTTPException(status_code=400, detail="La propiedad no pertenece al anfitrión")

    # Si hay reservation_id, validar que existe e involucra a ambos usuarios
    if data.reservation_id:
        reservation = await db.get(Reservation, data.reservation_id)
        if not reservation:
            raise HTTPException(status_code=404, detail="Reserva no encontrada")
        if reservation.guest_id != guest.id and reservation.host_id != host.id:
            raise HTTPException(status_code=400, detail="No tienes una reserva con este anfitrión")

    conv, _ = await get_or_create_conversation(
        db,
        guest_id=guest.id,
        host_id=data.host_id,
        property_id=data.property_id,
        reservation_id=data.reservation_id,
    )
    msg = await send_message(
        db,
        conversation=conv,
        sender=guest,
        data=MessageCreateIn(body=data.first_message),
    )
    return conv, msg


# ── Mensajes ──────────────────────────────────────────────────────────────────

async def get_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    before_id: Optional[uuid.UUID] = None,
    limit: int = 50,
) -> tuple[list[Message], bool]:
    """
    Retorna mensajes de una conversación en orden cronológico.
    Soporta paginación hacia atrás por cursor (before_id).
    """
    query = (
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            Message.conversation_id == conversation_id,
            Message.deleted_by_sender.is_(False),
        )
    )

    if before_id:
        cur_result = await db.execute(
            select(Message.created_at).where(Message.id == before_id)
        )
        cursor_ts = cur_result.scalar_one_or_none()
        if cursor_ts:
            query = query.where(Message.created_at < cursor_ts)

    query = query.order_by(Message.created_at.desc()).limit(limit + 1)
    result = await db.execute(query)
    msgs = list(result.scalars().all())

    has_more = len(msgs) > limit
    if has_more:
        msgs = msgs[:limit]

    msgs.reverse()

    # Resolver reply_to manualmente para evitar confusión del identity map de
    # SQLAlchemy con relaciones auto-referenciales (Message → Message).
    # selectinload en relaciones auto-referenciales puede asignar reply_to al
    # objeto incorrecto cuando los mensajes referenciados ya están en el pool.
    reply_ids = [m.reply_to_id for m in msgs if m.reply_to_id]
    if reply_ids:
        rr = await db.execute(
            select(Message)
            .options(selectinload(Message.sender))
            .where(Message.id.in_(reply_ids))
        )
        reply_map: dict[uuid.UUID, Message] = {r.id: r for r in rr.scalars()}
        for m in msgs:
            if m.reply_to_id and m.reply_to_id in reply_map:
                # Asignación directa en __dict__ para no disparar el lazy-loader
                m.__dict__["reply_to"] = reply_map[m.reply_to_id]

    return msgs, has_more


async def get_media_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    limit: int = 200,
) -> list[Message]:
    """Retorna los mensajes de imagen de la conversación (más recientes primero).

    Alimenta la sección "Fotos" del panel de detalles del chat sin depender de
    cuántos mensajes tenga cargados el cliente.
    """
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            Message.conversation_id == conversation_id,
            Message.message_type == "image",
            Message.deleted_by_sender.is_(False),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def _find_by_client_id(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    client_id: str,
) -> Optional[Message]:
    """Busca un mensaje ya creado con esta clave de idempotencia."""
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.sender))
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id == sender_id,
            Message.client_id == client_id,
        )
    )
    return result.scalar_one_or_none()


async def send_message(
    db: AsyncSession,
    conversation: Conversation,
    sender: User,
    data: MessageCreateIn,
) -> Message:
    """Crea un mensaje y actualiza el estado de la conversación."""
    # Idempotencia: si el cliente reintenta el mismo envío (el proxy puede
    # devolver 504 cuando el mensaje YA se creó y commiteó), devolver el
    # existente sin crear otra fila ni volver a incrementar no-leídos.
    if data.client_id:
        existing = await _find_by_client_id(db, conversation.id, sender.id, data.client_id)
        if existing:
            return existing

    msg = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        message_type=data.message_type,
        content=data.body,
        metadata_=data.metadata,
        reply_to_id=data.reply_to_id,
        client_id=data.client_id,
    )
    db.add(msg)
    try:
        await db.flush()
    except IntegrityError:
        # Carrera entre dos reintentos simultáneos: el índice único
        # uq_messages_conv_client rechazó el duplicado. Recuperar el original.
        await db.rollback()
        if data.client_id:
            existing = await _find_by_client_id(db, conversation.id, sender.id, data.client_id)
            if existing:
                return existing
        raise

    # Actualizar preview y timestamp en la conversación
    # (para imágenes el content es la URL: mostramos un preview amigable)
    preview = "📷 Foto" if data.message_type == "image" else (data.body or "")[:80]
    conversation.last_message_at = datetime.now(timezone.utc)
    conversation.last_message_preview = preview

    # Incrementar no-leídos del destinatario con UPDATE atómico en BD.
    # El `+= 1` sobre el objeto ORM usaba el valor leído al inicio del request:
    # si el receptor marcaba como leído (reset a 0) mientras este envío estaba
    # en vuelo, se re-escribía el contador viejo +1 y el badge quedaba inflado.
    is_guest_sender = sender.id == conversation.guest_id
    unread_col = (
        Conversation.unread_count_host if is_guest_sender else Conversation.unread_count_guest
    )
    await db.execute(
        update(Conversation)
        .where(Conversation.id == conversation.id)
        .values({unread_col.key: unread_col + 1})
    )
    # Sincronizar el objeto en memoria con el contador real de la BD (un
    # expire lazy provocaría MissingGreenlet si se serializa la conversación).
    await db.refresh(conversation, ["unread_count_host", "unread_count_guest"])

    await db.flush()

    # Registrar notificación de nuevo mensaje en la app.
    # Se aísla en un SAVEPOINT (begin_nested) para que, si el INSERT de
    # notificación falla a nivel de BD, NO contamine la transacción del
    # mensaje (Postgres aborta toda la transacción tras un error, lo que
    # haría fallar el commit y perder el mensaje).
    try:
        from app.modules.notifications.service import create_notification
        recipient_id = conversation.host_id if is_guest_sender else conversation.guest_id
        async with db.begin_nested():
            await create_notification(
                db,
                user_id=recipient_id,
                type="new_message",
                title=f"Nuevo mensaje de {sender.full_name}",
                body="Te envió una foto 📷" if data.message_type == "image" else preview,
                data={"conversation_id": str(conversation.id)},
                # Si el destinatario tiene este chat abierto (WS en vivo), el
                # mensaje le llega en pantalla: no duplicar con un push.
                send_push=not user_is_connected(conversation.id, recipient_id),
            )
    except Exception as e:
        logger.error("Error al crear notificación de nuevo mensaje: %s", e)

    # Resolver el mensaje al que se responde (una sola vez) para incluir su
    # preview tanto en el broadcast en tiempo real como en la respuesta HTTP.
    parent = None
    reply_payload = None
    if msg.reply_to_id:
        rr = await db.execute(
            select(Message).options(selectinload(Message.sender))
            .where(Message.id == msg.reply_to_id)
        )
        parent = rr.scalar_one_or_none()
        if parent:
            reply_payload = {
                "id": str(parent.id),
                "sender_id": str(parent.sender_id),
                "content": parent.content,
                "sender_name": getattr(parent.sender, "full_name", None),
            }

    # Broadcast en tiempo real (incluye reply_to para que el receptor vea a qué
    # mensaje se está respondiendo sin recargar el chat).
    await _broadcast(
        conversation.id,
        {
            "type": "message",
            "id": str(msg.id),
            "sender_id": str(sender.id),
            "sender_name": sender.full_name,
            "body": msg.content,
            "message_type": msg.message_type,
            "created_at": (msg.created_at or datetime.now(timezone.utc)).isoformat(),
            "reply_to": reply_payload,
            "metadata": msg.metadata_,
        },
    )

    logger.debug("Mensaje %s enviado en conv %s", msg.id, conversation.id)

    # Re-consultar con la relación `sender` cargada para evitar MissingGreenlet
    # al serializar MessageOut (lazy-load fuera del greenlet → 500 → rollback).
    result = await db.execute(
        select(Message).options(selectinload(Message.sender)).where(Message.id == msg.id)
    )
    saved = result.scalar_one()
    if parent:
        saved.__dict__["reply_to"] = parent

    return saved


async def mark_read(
    db: AsyncSession,
    conversation: Conversation,
    reader: User,
) -> int:
    """Marca como leídos los mensajes no leídos del otro participante."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation.id,
            Message.sender_id != reader.id,
            Message.read_at.is_(None),
            Message.deleted_by_sender.is_(False),
        )
    )
    msgs = result.scalars().all()
    count = 0
    for m in msgs:
        m.read_at = now
        m.is_read = True  # el frontend usa is_read para las palomitas azules
        count += 1

    # Resetear contador de no-leídos
    is_guest = reader.id == conversation.guest_id
    if is_guest:
        conversation.unread_count_guest = 0
    else:
        conversation.unread_count_host = 0

    await db.flush()

    # Limpiar las notificaciones "new_message" de esta conversación para que el
    # badge global (que cuenta notificaciones sin leer) baje al leer el chat.
    try:
        from app.modules.notifications.service import mark_message_notifications_read
        await mark_message_notifications_read(db, reader.id, conversation.id)
    except Exception as e:
        logger.error("Error al marcar notificaciones de mensajes leídas: %s", e)

    return count


async def delete_message(
    db: AsyncSession,
    conversation: Conversation,
    user: User,
    message_id: uuid.UUID,
) -> None:
    """Anula el envío de un mensaje propio (soft-delete, desaparece para ambos)."""
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation.id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg or msg.deleted_by_sender:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if msg.sender_id != user.id:
        raise HTTPException(status_code=403, detail="Solo puedes anular tus propios mensajes")

    msg.deleted_by_sender = True

    # Si el receptor aún no lo leía, descontarlo de su badge de no-leídos
    # (con piso en 0) para que el contador no quede inflado tras anular.
    if msg.read_at is None and msg.message_type != "system":
        unread_col = (
            Conversation.unread_count_host
            if msg.sender_id == conversation.guest_id
            else Conversation.unread_count_guest
        )
        await db.execute(
            update(Conversation)
            .where(Conversation.id == conversation.id)
            .values({unread_col.key: func.greatest(unread_col - 1, 0)})
        )
        await db.refresh(conversation, ["unread_count_host", "unread_count_guest"])

    await db.flush()

    # Si era el último mensaje, recalcular el preview de la conversación.
    last_result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation.id,
            Message.deleted_by_sender.is_(False),
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    last = last_result.scalar_one_or_none()
    if last is None:
        conversation.last_message_preview = None
    elif last.message_type == "image":
        conversation.last_message_preview = "📷 Foto"
    elif last.message_type == "system":
        conversation.last_message_preview = f"[Sistema] {(last.content or '')[:60]}"
    else:
        conversation.last_message_preview = (last.content or "")[:80]
    await db.flush()

    # Avisar en tiempo real para que desaparezca sin recargar.
    await _broadcast(conversation.id, {"type": "message_deleted", "id": str(message_id)})


async def send_system_message(
    db: AsyncSession,
    conversation: Conversation,
    body: str,
    metadata: Optional[dict] = None,
) -> Message:
    """Envía un mensaje de sistema (confirmación de reserva, etc.)."""
    msg = Message(
        conversation_id=conversation.id,
        sender_id=conversation.host_id,  # sistema usa el ID del host como sender ficticio
        message_type="system",
        content=body,
        metadata_=metadata,
    )
    db.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    conversation.last_message_preview = f"[Sistema] {body[:60]}"
    await db.flush()
    await _broadcast(conversation.id, {"type": "system", "body": body})
    return msg


# ── Reacciones ───────────────────────────────────────────────────────────────

async def add_reaction(
    db: AsyncSession, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str
) -> Message:
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(MessageReaction(message_id=message_id, user_id=user_id, emoji=emoji))
        await db.flush()

    result = await db.execute(
        select(Message).options(
            selectinload(Message.sender),
            selectinload(Message.reactions),
        ).where(Message.id == message_id)
    )
    return result.scalar_one()


async def remove_reaction(
    db: AsyncSession, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str
) -> Message:
    result = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji,
        )
    )
    reaction = result.scalar_one_or_none()
    if reaction:
        await db.delete(reaction)
        await db.flush()

    result = await db.execute(
        select(Message).options(
            selectinload(Message.sender),
            selectinload(Message.reactions),
        ).where(Message.id == message_id)
    )
    return result.scalar_one()


# ── SSE streams ───────────────────────────────────────────────────────────────

async def stream_conversation(
    conversation_id: uuid.UUID,
):
    """
    Generador async para SSE. Yields eventos SSE como strings.

    Uso en el router:
        return StreamingResponse(
            stream_conversation(conv_id),
            media_type="text/event-stream",
        )
    """
    import json
    q = _register_listener(conversation_id)
    try:
        # Ping inicial para confirmar conexión
        yield f"event: connected\ndata: {json.dumps({'conversation_id': str(conversation_id)})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=25.0)
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Heartbeat para mantener la conexión viva
                yield "event: ping\ndata: {}\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        _unregister_listener(conversation_id, q)
