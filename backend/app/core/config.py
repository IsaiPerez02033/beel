"""
Configuración central de Beel usando Pydantic Settings.
Lee variables de entorno y del archivo .env automáticamente.

Todos los servicios externos son opcionales: si no se configuran,
la app arranca en modo demo/degradado sin DB, Redis ni auth.
"""

from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Aplicación ────────────────────────────────────────────────────────────
    APP_NAME: str = "Beel"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | staging | production
    DEMO_MODE: bool = True  # true = sin servicios externos, datos mock (default para deploys sin config)
    BACKEND_URL: str = ""
    FRONTEND_URL: str = ""

    # ── Base de datos ─────────────────────────────────────────────────────────
    DATABASE_URL: Optional[str] = None
    DATABASE_ECHO: bool = False  # SQL echo logs

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: Optional[str] = None
    CACHE_TTL_SEARCH: int = 300
    CACHE_TTL_PROPERTY: int = 120
    CACHE_TTL_USER_PROFILE: int = 600
    CACHE_TTL_RANKING: int = 3600

    # ── Autenticación (NextAuth) ────────────────────────────────────────────────
    NEXTAUTH_SECRET: str = ""  # Secreto compartido con el frontend (HS256 para JWT)

    # ── AWS S3 ───────────────────────────────────────────────────────────────
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "beel-media"
    S3_BUCKET_URL: str = ""
    MAX_PHOTO_SIZE_BYTES: int = 10 * 1024 * 1024

    # ── Google Maps ───────────────────────────────────────────────────────────
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    LOCATION_OBFUSCATION_RADIUS_METERS: int = 150

    # ── MercadoPago ───────────────────────────────────────────────────────────
    MERCADOPAGO_ACCESS_TOKEN: Optional[str] = None
    MERCADOPAGO_PUBLIC_KEY: Optional[str] = None
    MERCADOPAGO_WEBHOOK_SECRET: Optional[str] = None
    PLATFORM_FEE_PERCENTAGE: float = 0.0

    # ── Stripe ───────────────────────────────────────────────────────────────
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # ── WhatsApp ──────────────────────────────────────────────────────────────
    WHATSAPP_API_KEY: Optional[str] = None
    WHATSAPP_API_URL: str = "https://waba.360dialog.io/v1"
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_TEMPLATE_NAMESPACE: Optional[str] = None

    # ── Email ─────────────────────────────────────────────────────────────────
    EMAIL_PROVIDER: str = "sendgrid"
    EMAIL_API_KEY: Optional[str] = None        # SendGrid API key (SG.xxx...)
    EMAIL_FROM_ADDRESS: str = "hola@beel.mx"
    EMAIL_FROM_NAME: str = "Beel"

    # ── Sentry ────────────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── Seguridad ─────────────────────────────────────────────────────────────
    MAX_REQUEST_BODY_SIZE: int = 1 * 1024 * 1024
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://beel.mx",
        "https://www.beel.mx",
        "https://beel-azure.vercel.app",
    ]
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # ── Negocio ───────────────────────────────────────────────────────────────
    AVAILABILITY_HORIZON_DAYS: int = 365
    RESERVATION_REQUEST_TIMEOUT_HOURS: int = 24
    PAYOUT_DELAY_HOURS: int = 24
    REVIEW_WINDOW_DAYS: int = 7

    @property
    def has_database(self) -> bool:
        return bool(self.DATABASE_URL)

    @property
    def has_redis(self) -> bool:
        return bool(self.REDIS_URL)

    @property
    def has_nextauth(self) -> bool:
        return bool(self.NEXTAUTH_SECRET)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache
def get_settings() -> Settings:
    """
    Retorna una instancia cacheada de Settings.
    El decorador @lru_cache garantiza que .env se lee una sola vez.

    Uso en FastAPI:
        settings = Depends(get_settings)
    """
    return Settings()


# Instancia global para importar directamente donde sea necesario
settings = get_settings()
