from fastapi import APIRouter, Depends
from datetime import date
from typing import List
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.estadisticas.service import EstadisticasService
from app.modules.estadisticas.schemas import (
    VentasPeriodoItem,
    ProductoTopItem,
    PedidosEstadoItem,
    IngresosResponse,
    ResumenResponse
)
from app.core.deps import require_role

router = APIRouter(
    prefix="/api/v1/estadisticas", 
    tags=["Estadisticas"],
    dependencies=[Depends(require_role(["ADMIN"]))]
)

def get_estadisticas_service(uow: PedidoUnitOfWork = Depends()) -> EstadisticasService:
    return EstadisticasService(uow)

@router.get("/ventas", response_model=List[VentasPeriodoItem])
def get_ventas(desde: date, hasta: date, agrupacion: str = 'day', service: EstadisticasService = Depends(get_estadisticas_service)):
    return service.get_ventas_periodo(desde, hasta, agrupacion)

@router.get("/productos-top", response_model=List[ProductoTopItem])
def get_productos_top(desde: date, hasta: date, limit: int = 5, service: EstadisticasService = Depends(get_estadisticas_service)):
    return service.get_productos_top(desde, hasta, limit)

@router.get("/pedidos-por-estado", response_model=List[PedidosEstadoItem])
def get_pedidos_estado(desde: date, hasta: date, service: EstadisticasService = Depends(get_estadisticas_service)):
    return service.get_pedidos_por_estado(desde, hasta)

@router.get("/ingresos", response_model=List[IngresosResponse])
def get_ingresos(desde: date, hasta: date, service: EstadisticasService = Depends(get_estadisticas_service)):
    return service.get_ingresos_por_forma_pago(desde, hasta)

@router.get("/resumen", response_model=ResumenResponse)
def get_resumen(desde: date, hasta: date, service: EstadisticasService = Depends(get_estadisticas_service)):
    return service.get_resumen_kpis(desde, hasta)
