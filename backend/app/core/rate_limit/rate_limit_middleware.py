# =============================================================================
# rate_limit_middleware.py — Middleware que aplica el rate limiter
# =============================================================================
#
# CONCEPTO CLAVE: Rate Limiting por IP vs por Usuario
# ----------------------------------------------------
# - POR IP: simple pero falla con NAT (una IP puede ser muchos usuarios).
#   Tampoco funciona bien con proxies/CDN.
# - POR USUARIO: más preciso, requiere estar autenticado.
# - HÍBRIDO: usamos IP para requests anónimos, user_id para autenticados.
#
# HEADERS HTTP ESTÁNDAR
# ----------------------------------------------------
# Hay tres headers estándar para rate limiting (RFC 6585 + draft IETF):
#
#   X-RateLimit-Limit:       Límite total (ej: "60")
#   X-RateLimit-Remaining:   Cuántas requests quedan (ej: "42")
#   X-RateLimit-Reset:       Unix timestamp del próximo reset (ej: "1700000000")
#   Retry-After:             Segundos a esperar antes de reintentar (solo en 429)
#
# GitHub, Twitter y la mayoría de las APIs públicas los usan.
# =============================================================================

from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.logger import get_logger
from app.core.rate_limit.rate_limiter import RateLimiter

logger = get_logger("app.middleware.rate_limit")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware que aplica rate limiting a cada request.

    Dos limiters configurables:
      - default_limiter: para todos los endpoints (límite "razonable").
      - auth_limiter:    para endpoints sensibles (login, register).
                         Mucho más estricto (mitiga fuerza bruta).

    Endpoints de auth (paths que matchean AUTH_PATHS) usan el auth_limiter.
    El resto usa el default_limiter.

    Registry de instances:
    ----------------------
    Mantenemos una lista de instances activas (`_instances`) para que los
    tests puedan resetear el estado entre tests sin tener que hackear
    las internals de Starlette.
    """

    # AGREGADO PARA TESTS: Registry de instances activas.
    # Se usa en tests/conftest.py para limpiar el estado entre tests
    # y evitar que se bloqueen entre sí.
    _instances: list["RateLimitMiddleware"] = []

    # Paths que matchean el auth_limiter (más estricto).
    AUTH_PATHS: tuple[str, ...] = (
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/logout",
    )

    # Paths EXCLUIDOS del rate limiting (health checks, docs, etc.).
    EXCLUDED_PATHS: set[str] = {
        "/health",
        "/",
        "/favicon.ico",
        "/openapi.json",
        "/docs",
        "/redoc",
    }

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

        # Creamos los dos limiters con la config de settings.
        # Cada uno tiene su propio dict de buckets en memoria.
        self.default_limiter = RateLimiter(
            capacity=settings.rate_limit_default_burst,
            refill_rate_per_minute=settings.rate_limit_default_per_minute,
        )
        self.auth_limiter = RateLimiter(
            capacity=settings.rate_limit_auth_burst,
            refill_rate_per_minute=settings.rate_limit_auth_per_minute,
        )

        # Registramos esta instance para que los tests puedan resetearla.
        RateLimitMiddleware._instances.append(self)

    @classmethod
    def reset_all_limiters(cls) -> None:
        """
        AGREGADO PARA TESTS: Limpia los buckets de todas las instancias activas.
        Se usa en `conftest.py` en un autouse fixture antes de cada test para 
        evitar que el rate limit de un test contamine al siguiente.
        """
        for instance in cls._instances:
            instance.default_limiter.reset_all()
            instance.auth_limiter.reset_all()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """
        Aplica rate limiting y agrega headers X-RateLimit-* a la response.
        """
        # 1) Excluir paths que no queremos rate-limitar.
        if request.url.path in self.EXCLUDED_PATHS:
            return await call_next(request)

        # 2) Determinar qué limiter usar según el path.
        limiter = (
            self.auth_limiter
            if any(request.url.path.startswith(p) for p in self.AUTH_PATHS)
            else self.default_limiter
        )

        # 3) Identificar al "cliente" (key del bucket).
        #    Prioridad: user_id (si está autenticado) > IP.
        #    Aquí asumimos anónimo y usamos IP; un middleware más sofisticado
        #    podría decodificar el JWT para usar el username.
        client_key = self._get_client_key(request)

        # 4) Verificar si la request pasa.
        if not limiter.is_allowed(client_key):
            # Logging: patrón de ataque posible (muchas requests desde misma IP).
            logger.warning(
                "Rate limit exceeded: key=%s path=%s method=%s",
                client_key, request.url.path, request.method,
            )
            # Devolvemos 429 directamente (sin pasar al endpoint).
            # Esto es más eficiente que lanzar una excepción y que el
            # exception handler la convierta.
            #
            # Retry-After (RFC 9110): "cuánto esperar hasta poder hacer
            # otro request". Si el balde está en 0, lo que necesitamos
            # es UN token, no el balde entero lleno.
            #   tiempo_para_1_token = 1 / refill_rate_seg
            #
            # Para auth (5/min = 0.0833 tok/seg) → 12 segundos.
            # Para default (60/min = 1 tok/seg) → 1 segundo.
            seconds_until_next_token = int(1 / max(limiter.refill_rate, 0.001))

            return Response(
                content=(
                    '{"error":{'
                    '"code":"rate_limit_exceeded",'
                    '"message":"Demasiadas peticiones. Intenta de nuevo más tarde.",'
                    f'"retry_after_seconds":{seconds_until_next_token},'
                    f'"retry_after":{seconds_until_next_token}'
                    '}}'
                ),
                status_code=429,
                media_type="application/json",
                headers={
                    # Estándar HTTP: segundos a esperar antes de reintentar.
                    "Retry-After": str(seconds_until_next_token),
                    "X-RateLimit-Limit": str(limiter.capacity),
                    "X-RateLimit-Remaining": "0",
                },
            )

        # 5) Si pasa, ejecutamos el endpoint normalmente.
        response = await call_next(request)

        # 6) Agregamos headers de rate limit a la response (estándar).
        response.headers["X-RateLimit-Limit"] = str(limiter.capacity)
        # Remaining es aproximado (no consultamos el bucket de nuevo para
        # no complicar el código; en producción se puede calcular exacto).
        response.headers["X-RateLimit-Remaining"] = str(max(0, int(limiter.capacity - 1)))

        return response

    @staticmethod
    def _get_client_key(request: Request) -> str:
        """
        Construye la key del cliente para el bucket.

        Estrategia:
          1. Si hay header X-Forwarded-For (proxy reverso), usamos la primera IP.
          2. Si no, usamos request.client.host (conexión directa).
        """
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
        if request.client:
            return f"ip:{request.client.host}"
        return "ip:unknown"
