"""
Configuración central de Beel usando Pydantic Settings.
Lee variables de entorno y del archivo .env automáticamente.
"""

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
    BACKEND_URL: str = ""  # URL pública del backend (ej. https://api.beel.mx)
    FRONTEND_URL: str = ""  # URL pública del frontend (ej. https://beel.mx)

    # ── Base de datos ─────────────────────────────────────────────────────────
    # Formato: postgresql+asyncpg://user:password@host:port/dbname
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/beel"

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    # TTL en segundos para diferentes tipos de cache
    CACHE_TTL_SEARCH: int = 300        # 5 minutos — resultados de búsqueda
    CACHE_TTL_PROPERTY: int = 120      # 2 minutos — detalle de propiedad
    CACHE_TTL_USER_PROFILE: int = 600  # 10 minutos — perfil de usuario
    CACHE_TTL_RANKING: int = 3600      # 1 hora — scores de ranking

    # ── Autenticación (Clerk) ─────────────────────────────────────────────────
    CLERK_SECRET_KEY: str = "sk_test_placeholder"
    CLERK_PUBLISHABLE_KEY: str = "pk_test_placeholder"
    CLERK_WEBHOOK_SECRET: str = "whsec_placeholder"

    # ── AWS S3 (almacenamiento de fotos) ──────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = "placeholder"
    AWS_SECRET_ACCESS_KEY: str = "placeholder"
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "beel-media"
    S3_BUCKET_URL: str = ""  # CloudFront URL cuando esté configurado
    # Tamaño máximo de foto en bytes (10MB)
    MAX_PHOTO_SIZE_BYTES: int = 10 * 1024 * 1024

    # ── Google Maps ───────────────────────────────────────────────────────────
    GOOGLE_MAPS_API_KEY: str = "placeholder"
    # Radio de ofuscación de coordenadas para mapa público (en metros)
    LOCATION_OBFUSCATION_RADIUS_METERS: int = 150

    # ── MercadoPago ───────────────────────────────────────────────────────────
    MERCADOPAGO_ACCESS_TOKEN: str = "placeholder"
    MERCADOPAGO_PUBLIC_KEY: str = "placeholder"
    MERCADOPAGO_WEBHOOK_SECRET: str = "placeholder"
    # Porcentaje de comisión de Beel (0 durante fase de lanzamiento)
    PLATFORM_FEE_PERCENTAGE: float = 0.0

    # ── Stripe ───────────────────────────────────────────────────────────────
    # Configurado pero desactivado en MVP v1
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # ── WhatsApp Business (360dialog) ────────────────────────────────────────
    WHATSAPP_API_KEY: str = "placeholder"
    WHATSAPP_API_URL: str = "https://waba.360dialog.io/v1"
    WHATSAPP_PHONE_NUMBER_ID: str = "placeholder"
    # Namespace de plantillas aprobadas por Meta
    WHATSAPP_TEMPLATE_NAMESPACE: str = "placeholder"

    # ── Email (SendGrid o Resend) ─────────────────────────────────────────────
    EMAIL_PROVIDER: str = "resend"  # resend | sendgrid
    EMAIL_API_KEY: str = "placeholder"
    EMAIL_FROM_ADDRESS: str = "hola@beel.mx"
    EMAIL_FROM_NAME: str = "Beel"

    # ── Sentry (monitoreo de errores) ─────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── Seguridad ─────────────────────────────────────────────────────────────
    # Límite de tamaño de request body (bytes)
    MAX_REQUEST_BODY_SIZE: int = 1 * 1024 * 1024  # 1 MB
    # Dominios permitidos para CORS
    ALLOWED_ORIGINS: list[str] = [
        "https://beel.mx",
        "https://www.beel.mx",
    ]
    # Rate limiting (requests por minuto por IP)
    RATE_LIMIT_PER_MINUTE: int = 60
    # Rate limiting para endpoints de auth
    RATE_LIMIT_AUTH_PER_MINUTE: int = 10

    # ── Negocio ───────────────────────────────────────────────────────────────
    # Días de calendario a generar hacia adelante para nuevos listings
    AVAILABILITY_HORIZON_DAYS: int = 365
    # Horas de gracia para que el host responda una solicitud
    RESERVATION_REQUEST_TIMEOUT_HOURS: int = 24
    # Horas después del check-in para liberar el pago al host
    PAYOUT_DELAY_HOURS: int = 24
    # Días disponibles para dejar una reseña post check-out
    REVIEW_WINDOW_DAYS: int = 7

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
