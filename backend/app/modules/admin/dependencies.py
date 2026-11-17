"""Composición del módulo `admin` (estadísticas): arma `EstadisticasService` sobre la unidad de trabajo de pedidos (D1)."""
from typing import Annotated

from fastapi import Depends

from app.core.database import SessionDep
from app.modules.admin.service import EstadisticasService
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork


def get_estadisticas_service(session: SessionDep) -> EstadisticasService:
    return EstadisticasService(PedidoUnitOfWork(session))


EstadisticasServiceDep = Annotated[EstadisticasService, Depends(get_estadisticas_service)]
