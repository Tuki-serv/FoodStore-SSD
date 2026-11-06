# =============================================================================
# logger.py — Configuración del sistema de logging
# =============================================================================
#
# CONCEPTO CLAVE: logging estructurado en FastAPI
# ----------------------------------------------------
# Python provee el módulo `logging` de la stdlib. FastAPI lo usa internamente
# (uvicorn emite logs al arrancar, etc.). La clave para una app profesional es:
#
#   1. UN SOLO punto de configuración (esta función setup_logging()).
#   2. Llamarla ANTES que cualquier otra cosa (al arrancar la app).
#   3. Loggers nombrados por jerarquía: "app", "app.core", "app.modules.x".
#      Esto permite configurar niveles por módulo sin tocar cada archivo.
#
# FORMATO DEL LOG
# ----------------------------------------------------
# El formato incluye:
#   - timestamp ISO 8601 (UTC) → ordenable, parseable, locale-independent.
#   - levelname (INFO/WARN/ERROR) → filtrable.
#   - name (nombre del logger) → identifica el módulo que emite.
#   - message → el mensaje en sí.
#
# Es un "structured-friendly" log: NO usa JSON, pero los campos están bien
# delimitados y un parser puede extraerlos fácilmente.
# =============================================================================

import logging
import sys
from typing import Literal

from app.core.config import settings


def setup_logging(level_name: str | None = None) -> None:
    """
    Configura el sistema de logging de la aplicación.

    Idempotente: se puede llamar varias veces sin duplicar handlers.
    Esto importa porque uvicorn puede recargar la app en modo --reload.

    Args:
        level_name: nombre del nivel (ej: "INFO", "DEBUG"). Si es None,
                    usa `settings.LOG_LEVEL`.
    """
    # Lee el nivel desde el argumento o desde settings.
    if level_name is None:
        level_name = settings.LOG_LEVEL
    level: int = getattr(logging, level_name)

    # ─── Handler: a dónde van los logs ───────────────────────────────────────
    # StreamHandler(sys.stdout) → consola. En producción, reemplazable por
    # FileHandler, SocketHandler (centralizado), CloudWatchHandler, etc.
    handler = logging.StreamHandler(sys.stdout)

    # ─── Formatter: cómo se ve cada línea ────────────────────────────────────
    # asctime: timestamp.
    # levelname: WARNING, ERROR, etc.
    # name: nombre del logger (ej: "app.modules.pedidos.service").
    # message: el mensaje.
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-30s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    # ─── Logger raíz "app" ──────────────────────────────────────────────────
    # Todos los loggers de la app cuelgan de "app.*". Configuramos el padre.
    app_logger = logging.getLogger("app")
    app_logger.setLevel(level)
    # IMPORTANTE: limpiar handlers previos para no duplicar en --reload.
    app_logger.handlers.clear()
    app_logger.addHandler(handler)
    # propagate=False evita que los logs se dupliquen al logger raíz de Python.
    app_logger.propagate = False

    # ─── Reducir ruido de librerías externas ────────────────────────────────
    # uvicorn y sqlalchemy son MUY verbosos. Los silenciamos parcialmente.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Atajo para crear loggers hijos del logger "app".

    Uso típico:
        from app.core.logger import get_logger
        logger = get_logger(__name__)  # __name__ = "app.modules.pedidos.service"
        logger.info("Pedido creado", extra={"pedido_id": 42})

    Devuelve un logger que hereda la configuración del logger "app".
    """
    return logging.getLogger(name)
