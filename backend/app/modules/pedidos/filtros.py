"""Filtros del listado de pedidos: dataclass sin Pydantic ni FastAPI, compartida por repositorio, service y router (D4)."""
from dataclasses import dataclass
from datetime import date
from typing import Literal

EstadoPedidoCodigo = Literal["PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO", "CANCELADO"]


@dataclass(frozen=True)
class FiltrosPedidos:
    """Filtros opcionales del listado (query params): estado y rango de fechas de creación, inclusivo, en UTC."""
    estado: EstadoPedidoCodigo | None = None
    desde: date | None = None
    hasta: date | None = None
