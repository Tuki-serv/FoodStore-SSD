"""Composición del módulo `admin` (estadísticas): arma `EstadisticasService` sobre la unidad de trabajo de pedidos (D1)."""
from dataclasses import dataclass
from datetime import date
from typing import Annotated

from fastapi import Depends
from fastapi.exceptions import RequestValidationError

from app.core.database import SessionDep
from app.modules.admin.service import EstadisticasService
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork


def get_estadisticas_service(session: SessionDep) -> EstadisticasService:
    return EstadisticasService(PedidoUnitOfWork(session))


EstadisticasServiceDep = Annotated[EstadisticasService, Depends(get_estadisticas_service)]


MAX_DIAS_RANGO = 366


@dataclass(frozen=True)
class RangoFechas:
    """Rango inclusivo `desde`..`hasta` de los reportes de estadísticas."""

    desde: date
    hasta: date


def _error_de_campo(campo: str, mensaje: str, valor: date) -> RequestValidationError:
    # Mismo mecanismo que un error de validación de FastAPI: el handler arma `{detail, code: VALIDATION_ERROR, field}`.
    return RequestValidationError([{"type": "value_error", "loc": ("query", campo), "msg": mensaje, "input": valor}])


def get_rango_fechas(desde: date, hasta: date) -> RangoFechas:
    if desde > hasta:
        raise _error_de_campo("desde", "'desde' no puede ser posterior a 'hasta'", desde)
    if (hasta - desde).days + 1 > MAX_DIAS_RANGO:
        raise _error_de_campo("hasta", f"el período no puede superar {MAX_DIAS_RANGO} días", hasta)
    return RangoFechas(desde, hasta)


RangoFechasDep = Annotated[RangoFechas, Depends(get_rango_fechas)]
