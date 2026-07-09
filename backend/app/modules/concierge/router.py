"""Router del Concierge (planeador de viajes con IA)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser
from app.core.database import get_db
from app.core.limiter import limiter
from app.modules.concierge import service
from app.modules.concierge.schemas import ConciergeChatIn, ConciergeChatOut

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ConciergeChatOut)
@limiter.limit("15/minute")
async def chat(
    body: ConciergeChatIn,
    current_user: CurrentUser,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Conversa con el Concierge de Beel. Requiere sesión (controla el gasto)."""
    try:
        result = await service.chat(db, [m.model_dump() for m in body.messages])
        return ConciergeChatOut(**result)
    except HTTPException:
        raise
    except Exception as e:  # DEBUG TEMPORAL: exponer la causa real para diagnosticar
        logger.exception("Concierge error")
        raise HTTPException(status_code=500, detail=f"Concierge: {type(e).__name__}: {str(e)[:300]}")
