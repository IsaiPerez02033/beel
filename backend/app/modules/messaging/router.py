"""Router de mensajería con SSE."""

import asyncio
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.modules.messaging import service
from app.modules.messaging.schemas import (
    ConversationListOut,
    ConversationOut,
    ConversationStartIn,
    MessageCreateIn,
    MessageListOut,
    MessageOut,
)
from app.modules.users import service as user_service
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Inbox ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=ConversationListOut)
async def list_conversations(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Lista todas las conversaciones del usuario autenticado."""
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    convs = await service.list_conversations(db, user.id)
    return ConversationListOut(conversations=convs, total=len(convs))


@router.post("", response_model=ConversationOut, status_code=201)
@limiter.limit("10/minute")
async def start_conversation(
    request: Request,
    data: ConversationStartIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Inicia una nueva conversación con un anfitrión."""
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == data.host_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte mensajes a ti mismo")
    conv, _ = await service.start_conversation(db, user, data)
    return conv


# ── Mensajes de una conversación ──────────────────────────────────────────────

@router.get("/{conversation_id}/messages", response_model=MessageListOut)
async def get_messages(
    conversation_id: uuid.UUID,
    before_id: Optional[uuid.UUID] = Query(None, description="Cursor para paginación hacia atrás"),
    limit: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = ...,
    db: AsyncSession = Depends(get_db),
):
    """Lista los mensajes de una conversación (más recientes al final)."""
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    conv = await service.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    _assert_participant(conv, user.id)

    msgs, has_more = await service.get_messages(db, conversation_id, before_id, limit)
    # Marcar como leídos
    await service.mark_read(db, conv, user)

    return MessageListOut(messages=msgs, total=len(msgs), has_more=has_more)


@router.post("/{conversation_id}/messages", response_model=MessageOut, status_code=201)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    conversation_id: uuid.UUID,
    data: MessageCreateIn,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Envía un mensaje en una conversación."""
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    conv = await service.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    _assert_participant(conv, user.id)

    msg = await service.send_message(db, conv, user, data)
    return msg


@router.post("/{conversation_id}/read", status_code=200)
async def mark_read(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Marca como leídos los mensajes no leídos."""
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    conv = await service.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    _assert_participant(conv, user.id)

    count = await service.mark_read(db, conv, user)
    return {"marked_read": count}


# ── SSE stream ────────────────────────────────────────────────────────────────

@router.get("/{conversation_id}/stream")
async def stream_messages(
    conversation_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events para mensajes en tiempo real.

    El cliente conecta con EventSource:
        const es = new EventSource(`/api/v1/messaging/${convId}/stream`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        es.addEventListener('message', e => console.log(JSON.parse(e.data)));
        es.addEventListener('ping', () => {}); // keepalive
    """
    user = await user_service.get_user_by_id(db, uuid.UUID(current_user.sub))
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    conv = await service.get_conversation(db, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    _assert_participant(conv, user.id)

    return StreamingResponse(
        service.stream_conversation(conversation_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Deshabilita buffering en Nginx
            "Connection": "keep-alive",
        },
    )


# ── WebSocket (reemplaza SSE) ─────────────────────────────────────────────────

@router.websocket("/{conversation_id}/ws")
async def websocket_messages(
    ws: WebSocket,
    conversation_id: uuid.UUID,
    token: str = Query(...),
):
    """
    WebSocket endpoint para mensajería en tiempo real.
    Reemplaza el SSE. El JWT se envía como query param en el handshake.

    Cliente:
        const ws = new WebSocket(`wss://api.beel.mx/api/v1/messaging/${convId}/ws?token=${jwt}`);
    """
    from app.core.auth import _verify_token
    from app.core.database import AsyncSessionLocal
    import uuid as _uuid

    # Validar token JWT (HS256, NextAuth) antes de aceptar la conexión
    try:
        claims = _verify_token(token)
        user_id_str = claims.get("sub")
        if not user_id_str:
            await ws.close(code=4001, reason="Token inválido")
            return
    except Exception:
        await ws.close(code=4001, reason="Token inválido o expirado")
        return

    # Obtener el usuario por su UUID (claim sub del JWT de NextAuth)
    async with AsyncSessionLocal() as db:
        user = await user_service.get_user_by_id(db, _uuid.UUID(user_id_str))
        if not user:
            await ws.close(code=4003, reason="Usuario no encontrado")
            return

        conv = await service.get_conversation(db, conversation_id)
        if not conv:
            await ws.close(code=4004, reason="Conversación no encontrada")
            return

        if conv.guest_id != user.id and conv.host_id != user.id:
            await ws.close(code=4003, reason="No autorizado")
            return

    await ws.accept()

    # Registrar listener para broadcast
    q: asyncio.Queue = service._register_listener(conversation_id)

    try:
        # Notificar conexión
        await ws.send_json({"type": "connected", "conversation_id": str(conversation_id)})

        while True:
            # Escuchar mensajes entrantes del cliente
            try:
                data = await asyncio.wait_for(ws.receive_json(), timeout=30.0)
                if data.get("type") == "message" and data.get("body"):
                    async with AsyncSessionLocal() as db:
                        conv = await service.get_conversation(db, conversation_id)
                        if conv:
                            await service.send_message(
                                db,
                                conversation=conv,
                                sender=user,
                                data=MessageCreateIn(body=data["body"][:4000]),
                            )
                            await db.commit()
            except asyncio.TimeoutError:
                # Ping para mantener conexión viva
                await ws.send_json({"type": "ping"})

            # Enviar eventos de broadcast al cliente
            while not q.empty():
                try:
                    event = q.get_nowait()
                    await ws.send_json(event)
                except asyncio.QueueEmpty:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        service._unregister_listener(conversation_id, q)


# ── Helper ────────────────────────────────────────────────────────────────────

def _assert_participant(conv, user_id: uuid.UUID) -> None:
    if conv.guest_id != user_id and conv.host_id != user_id:
        raise HTTPException(status_code=403, detail="No eres participante de esta conversación")
