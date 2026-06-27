"""Lógica de negocio para mensajería."""

import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.modules.messaging.models import Conversation, Message
from app.modules.messaging.schemas import ConversationStartIn, MessageCreateIn
from app.modules.users.models import User
from app.modules.properties.models import Property
from app.modules.reservations.models import Reservation

logger = logging.getLogger(__name__)

# ── SSE: cola de eventos por conversación ─────────────────────────────────────
# Dict[conversation_id → List[asyncio.Queue]]
# Cada conexión SSE activa tiene su propia Queue.
_sse_listeners: dict[uuid.UUID, list[asyncio.Queue]] = {}


def _register_listener(conversation_id: uuid.UUID) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_listeners.setdefault(conversation_id, []).append(q)
    return q


def _unregister_listener(conversation_id: uuid.UUID, q: asyncio.Queue) -> None:
    listeners = _sse_listeners.get(conversation_id, [])
    if q in listeners:
        listeners.remove(q)
    if not listeners:
        _sse_listeners.pop(conversation_id, None)


async def _broadcast(conversation_id: uuid.UUID, event: dict) -> None:
    """Envía un evento a todas las colas SSE activas de la conversación."""
    for q in _sse_listeners.get(conversation_id, []):
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
    return result.scalar_one_or_none()


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
        # Obtener created_at del cursor
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

    # Retornar en orden cronológico (más antiguo primero)
    msgs.reverse()
    return msgs, has_more


async def send_message(
    db: AsyncSession,
    conversation: Conversation,
    sender: User,
    data: MessageCreateIn,
) -> Message:
    """Crea un mensaje y actualiza el estado de la conversación."""
    msg = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        message_type=data.message_type,
        content=data.body,
        metadata_=data.metadata,
    )
    db.add(msg)

    # Actualizar preview y timestamp en la conversación
    preview = (data.body or "")[:80]
    conversation.last_message_at = datetime.now(timezone.utc)
    conversation.last_message_preview = preview

    # Incrementar no-leídos del destinatario
    is_guest_sender = sender.id == conversation.guest_id
    if is_guest_sender:
        conversation.unread_count_host += 1
    else:
        conversation.unread_count_guest += 1

    await db.flush()

    # Broadcast SSE
    await _broadcast(
        conversation.id,
        {
            "type": "message",
            "id": str(msg.id),
            "sender_id": str(sender.id),
            "sender_name": sender.full_name,
            "body": msg.content,
            "message_type": msg.message_type,
            "created_at": msg.created_at.isoformat(),
        },
    )

    logger.debug("Mensaje %s enviado en conv %s", msg.id, conversation.id)
    return msg


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
        count += 1

    # Resetear contador de no-leídos
    is_guest = reader.id == conversation.guest_id
    if is_guest:
        conversation.unread_count_guest = 0
    else:
        conversation.unread_count_host = 0

    await db.flush()
    return count


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
        body=body,
        metadata_=metadata,
    )
    db.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    conversation.last_message_preview = f"[Sistema] {body[:60]}"
    await db.flush()
    await _broadcast(conversation.id, {"type": "system", "body": body})
    return msg


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
