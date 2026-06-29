"""
Beel API — Entry point de FastAPI.

Estructura de rutas:
  /api/v1/health              — health check
  /api/v1/users               — usuarios y perfiles
  /api/v1/properties          — propiedades y búsqueda
  /api/v1/reservations        — reservas, disponibilidad
  /api/v1/payments            — pagos con MercadoPago
  /api/v1/messaging           — mensajería en tiempo real
  /api/v1/payments/webhook/mercadopago — webhook de MercadoPago
"""

import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.database import init_db, dispose_engine
from app.core.limiter import limiter
from app.modules.users.router import router as users_router
from app.modules.properties.router import router as properties_router
from app.modules.reservations.router import router as reservations_router
from app.modules.payments.router import router as payments_router
from app.modules.messaging.router import router as messaging_router
from app.modules.reviews.router import router as reviews_router
from app.modules.webhooks.clerk import router as clerk_webhook_router
from app.modules.notifications.router import router as notifications_router
from app.modules.favorites.router import router as favorites_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Sentry ────────────────────────────────────────────────────────────────────
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0.2,
    )

# ── Rate limiter ──────────────────────────────────────────────────────────────
# Instancia compartida en app.core.limiter

# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando Beel API v%s (%s)", settings.APP_VERSION, settings.ENVIRONMENT)

    if settings.DEMO_MODE:
        logger.info("🎭 MODO DEMO: sin servicios externos")
    else:
        if settings.has_database:
            await init_db()
        else:
            logger.info("⚠️ Sin DATABASE_URL — endpoints dependientes de BD retornarán 503")
        if settings.NEXTAUTH_SECRET:
            logger.info("✅ NextAuth configurado")
        else:
            logger.info("⚠️ Sin NEXTAUTH_SECRET — auth deshabilitada")
        if settings.has_redis:
            logger.info("✅ Redis configurado")
        else:
            logger.info("⚠️ Sin Redis — cache deshabilitado")

    yield
    logger.info("🛑 Apagando Beel API")
    if settings.has_database:
        await dispose_engine()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Beel API",
    description="API de la plataforma de hospedajes Beel",
    version=settings.APP_VERSION,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

# CORS — allow_origins=["*"] es compatible con JWT (Authorization header).
# No usamos cookies así que allow_credentials puede ser False con wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# ── Request ID middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    import uuid
    request_id = str(uuid.uuid4())[:8]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Body size limit middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_REQUEST_BODY_SIZE:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body too large"},
        )
    return await call_next(request)


# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(users_router, prefix=f"{API_PREFIX}/users", tags=["users"])
app.include_router(properties_router, prefix=f"{API_PREFIX}/properties", tags=["properties"])
app.include_router(reservations_router, prefix=f"{API_PREFIX}/reservations", tags=["reservations"])
app.include_router(payments_router, prefix=f"{API_PREFIX}/payments", tags=["payments"])
app.include_router(messaging_router, prefix=f"{API_PREFIX}/messaging", tags=["messaging"])
app.include_router(reviews_router, prefix=f"{API_PREFIX}/reviews", tags=["reviews"])
app.include_router(clerk_webhook_router, prefix=f"{API_PREFIX}/webhooks", tags=["webhooks"])
app.include_router(notifications_router, prefix=f"{API_PREFIX}/notifications", tags=["notifications"])
app.include_router(favorites_router, prefix=f"{API_PREFIX}/favorites", tags=["favorites"])


# ── Root ────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "demo": settings.DEMO_MODE,
        "docs": "/docs",
        "health": "/api/v1/health",
        "api": "/api/v1",
    }


# ── Health check ──────────────────────────────────────────────────────────────
@app.get(f"{API_PREFIX}/health", tags=["health"])
async def health_check():
    if settings.is_production:
        return {"status": "ok"}
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    try:
        logger.exception("Unhandled exception: %s", type(exc).__name__)
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Ocurrió un error interno. Intenta de nuevo."},
    )
