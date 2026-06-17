"""Rate limiter compartido para todos los módulos."""

from fastapi import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """Obtiene la IP real del cliente, respetando X-Forwarded-For."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip, default_limits=["60/minute"])
