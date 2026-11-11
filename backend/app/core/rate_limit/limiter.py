"""Limitador de la app (slowapi sobre `limits`) y adaptador para contar eventos por clave (design D1, D3, D4)."""
import math
import time
from typing import Protocol

from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.errors import AppError, ErrorCode
from app.core.logger import get_logger

logger = get_logger("app.rate_limit")

# Ventana deslizante y storage en memoria (un solo proceso). `app.state.limiter` lo publica `create_app`.
limiter = Limiter(
    key_func=get_remote_address,
    strategy="moving-window",
    storage_uri="memory://",
    headers_enabled=False,
)

MENSAJE_LIMITE_LOGIN = "Demasiados intentos fallidos de inicio de sesión. Intentá de nuevo más tarde."


class RegistroIntentos(Protocol):
    """Lo que un service conoce de un limitador: verificar el cupo, registrar un evento y reiniciar la cuenta."""

    def verificar(self, clave: str) -> None: ...

    def registrar(self, clave: str) -> None: ...

    def reiniciar(self, clave: str) -> None: ...


class LimitadorPorClave:
    """Cuenta eventos por clave (p. ej. IP) con un límite `limits` (`"5 per 15 minutes"`) dentro de un ámbito."""

    def __init__(self, limiter: Limiter, limite: str, ambito: str, mensaje: str = MENSAJE_LIMITE_LOGIN) -> None:
        self.limiter = limiter
        self._item = parse(limite)
        self._ambito = ambito
        self._mensaje = mensaje

    def verificar(self, clave: str) -> None:
        """Lanza 429 `RATE_LIMIT_EXCEEDED` con `Retry-After` si la clave agotó su cupo; no registra nada."""
        estrategia = self.limiter.limiter
        if estrategia.test(self._item, self._ambito, clave):
            return
        reset_time = estrategia.get_window_stats(self._item, self._ambito, clave).reset_time
        espera = max(1, math.ceil(reset_time - time.time()))
        logger.warning("Límite excedido ambito=%s ip=%s", self._ambito, clave)
        raise AppError(
            429, ErrorCode.RATE_LIMIT_EXCEEDED, self._mensaje, headers={"Retry-After": str(espera)}
        )

    def registrar(self, clave: str) -> None:
        self.limiter.limiter.hit(self._item, self._ambito, clave)

    def reiniciar(self, clave: str) -> None:
        self.limiter.limiter.clear(self._item, self._ambito, clave)
