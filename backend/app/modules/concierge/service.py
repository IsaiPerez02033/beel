"""
Concierge de Beel — planeador de viajes con IA.

Llama a la API de Claude (Messages API) por HTTP con httpx (ya es dependencia,
así evitamos tocar poetry.lock) usando *tool use* sobre las búsquedas REALES de
alojamientos y experiencias. El modelo nunca inventa lugares ni precios: solo
recomienda lo que devuelven las herramientas.

Modelo por defecto: claude-haiku-4-5 (barato, buen español, tool use nativo).
Costo aproximado por itinerario: ~1 centavo de dólar.
"""

import json
import logging
from decimal import Decimal

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.properties import service as prop_service
from app.modules.experiences import service as exp_service

logger = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
MAX_TOOL_ITERATIONS = 4

SYSTEM_PROMPT = """Eres el Concierge de Beel, un planeador de viajes por México.

Beel es un marketplace de hospedajes y experiencias (tours, clases, actividades)
con anfitriones locales. Tu trabajo es entender qué busca el viajero (destino,
fechas, presupuesto, número de personas, intereses) y armarle un plan concreto.

Reglas:
- Usa SIEMPRE las herramientas para buscar alojamientos y experiencias reales en
  Beel. NUNCA inventes lugares, precios, ni identificadores. Solo recomienda lo
  que devuelvan las herramientas.
- Si el viajero no dio un dato clave (destino), pregúntalo en una frase antes de
  buscar. Si ya lo dio, busca directo.
- Arma un plan claro y cálido en español. Si hay varias noches, propón un
  itinerario día por día. Menciona los lugares por su nombre; NO pegues URLs ni
  IDs (las tarjetas con enlaces se muestran aparte, debajo de tu mensaje).
- Precios en pesos mexicanos (MXN). Sé honesto con el presupuesto.
- Si no hay resultados para un destino o filtro, dilo con claridad y sugiere una
  alternativa cercana o ajustar el presupuesto.
- Sé conciso: ve al plan, sin relleno.
- Escribe en TEXTO PLANO. No uses Markdown: nada de asteriscos (**), almohadillas
  (#) ni guiones para listas. Si necesitas una lista, usa viñetas con "•" o
  números (1., 2.). Para un itinerario, separa los días en párrafos.
"""

TOOLS = [
    {
        "name": "buscar_alojamientos",
        "description": (
            "Busca hospedajes reales publicados en Beel por destino (ciudad o "
            "estado de México), precio máximo por noche y número de huéspedes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "destino": {"type": "string", "description": "Ciudad o estado, ej. 'Oaxaca'"},
                "precio_max": {"type": "number", "description": "Precio máximo por noche en MXN (opcional)"},
                "huespedes": {"type": "integer", "description": "Número de huéspedes (opcional)"},
            },
            "required": ["destino"],
        },
    },
    {
        "name": "buscar_experiencias",
        "description": (
            "Busca experiencias/tours/actividades reales en Beel por destino y "
            "categoría."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "destino": {"type": "string", "description": "Ciudad o estado"},
                "categoria": {
                    "type": "string",
                    "description": "Una de: gastronomia, aventura, cultura, arte, naturaleza, deporte, bienestar, vida_nocturna, tour, otro (opcional)",
                },
                "precio_max": {"type": "number", "description": "Precio máximo por persona en MXN (opcional)"},
            },
            "required": ["destino"],
        },
    },
]


def _num(v):
    return Decimal(str(v)) if v is not None else None


async def _run_tool(db: AsyncSession, name: str, args: dict, pool: dict) -> list[dict]:
    """Ejecuta una herramienta y devuelve un resumen compacto para el modelo.

    Además acumula las tarjetas completas en `pool` para que el frontend las
    renderice.
    """
    if name == "buscar_alojamientos":
        res = await prop_service.search_properties(
            db,
            destino=args.get("destino"),
            precio_max=_num(args.get("precio_max")),
            huespedes=args.get("huespedes"),
            per_page=6,
        )
        compact = []
        for p in res.properties:
            data = p.model_dump(mode="json")
            pool["properties"][str(p.id)] = data
            compact.append({
                "id": str(p.id),
                "titulo": p.title,
                "ciudad": p.city,
                "precio_noche_mxn": float(p.price_per_night),
                "huespedes_max": p.max_guests,
                "recamaras": p.bedrooms,
            })
        return compact

    if name == "buscar_experiencias":
        res = await exp_service.search_experiences(
            db,
            destino=args.get("destino"),
            categoria=args.get("categoria"),
            precio_max=_num(args.get("precio_max")),
            per_page=6,
        )
        compact = []
        for e in res.experiences:
            data = e.model_dump(mode="json")
            pool["experiences"][str(e.id)] = data
            compact.append({
                "id": str(e.id),
                "titulo": e.title,
                "ciudad": e.city,
                "categoria": e.category,
                "precio_persona_mxn": float(e.price_per_person),
                "duracion_min": e.duration_minutes,
            })
        return compact

    return [{"error": f"herramienta desconocida: {name}"}]


async def chat(db: AsyncSession, messages: list[dict]) -> dict:
    """Corre el loop de conversación con tool use y devuelve la respuesta final."""
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="El Concierge no está configurado todavía.")

    # Historial en formato Anthropic (el content puede ser string simple).
    convo = [{"role": m["role"], "content": m["content"]} for m in messages]
    pool = {"properties": {}, "experiences": {}}

    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        for _ in range(MAX_TOOL_ITERATIONS):
            body = {
                "model": settings.CONCIERGE_MODEL,
                "max_tokens": 1500,
                "system": SYSTEM_PROMPT,
                "tools": TOOLS,
                "messages": convo,
            }
            resp = await client.post(ANTHROPIC_URL, headers=headers, json=body)
            if resp.status_code != 200:
                logger.error("Error de Claude API: %s %s", resp.status_code, resp.text[:500])
                raise HTTPException(status_code=502, detail="El Concierge no está disponible en este momento.")

            data = resp.json()
            content = data.get("content", [])
            stop_reason = data.get("stop_reason")

            if stop_reason == "tool_use":
                # Ejecutar cada tool_use y devolver los resultados.
                convo.append({"role": "assistant", "content": content})
                tool_results = []
                for block in content:
                    if block.get("type") == "tool_use":
                        result = await _run_tool(db, block["name"], block.get("input", {}), pool)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block["id"],
                            "content": json.dumps(result, ensure_ascii=False),
                        })
                convo.append({"role": "user", "content": tool_results})
                continue

            # Respuesta final: juntar los bloques de texto.
            reply = "".join(b.get("text", "") for b in content if b.get("type") == "text").strip()
            return {
                "reply": reply or "¿Me cuentas a dónde te gustaría viajar y con qué presupuesto?",
                "properties": list(pool["properties"].values()),
                "experiences": list(pool["experiences"].values()),
            }

    # Se agotaron las iteraciones de herramientas.
    return {
        "reply": "Encontré varias opciones; cuéntame un poco más para afinar el plan.",
        "properties": list(pool["properties"].values()),
        "experiences": list(pool["experiences"].values()),
    }
