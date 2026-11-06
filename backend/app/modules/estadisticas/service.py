from datetime import date
from typing import List
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.estadisticas.schemas import (
    VentasPeriodoItem,
    ProductoTopItem,
    PedidosEstadoItem,
    IngresosResponse,
    ResumenResponse
)

class EstadisticasService:
    def __init__(self, uow: PedidoUnitOfWork):
        self.uow = uow

    def get_ventas_periodo(self, desde: date, hasta: date, agrupacion: str = 'day') -> List[VentasPeriodoItem]:
        with self.uow:
            rows = self.uow.pedidos.get_ventas_periodo(desde, hasta, agrupacion)
            return [
                VentasPeriodoItem(
                    fecha=row.fecha,
                    total_ventas=row.total_ventas or 0,
                    cantidad_pedidos=row.cantidad_pedidos
                ) for row in rows
            ]

    def get_productos_top(self, desde: date, hasta: date, limit: int = 5) -> List[ProductoTopItem]:
        with self.uow:
            rows = self.uow.detalles.get_productos_top(desde, hasta, limit)
            return [
                ProductoTopItem(
                    nombre=row.nombre,
                    ingresos=row.ingresos or 0,
                    cantidad_vendida=row.cantidad_vendida or 0
                ) for row in rows
            ]

    def get_pedidos_por_estado(self, desde: date, hasta: date) -> List[PedidosEstadoItem]:
        with self.uow:
            rows = self.uow.pedidos.get_pedidos_por_estado(desde, hasta)
            return [
                PedidosEstadoItem(
                    estado_codigo=row.estado_codigo,
                    cantidad=row.cantidad
                ) for row in rows
            ]

    def get_ingresos_por_forma_pago(self, desde: date, hasta: date) -> List[IngresosResponse]:
        with self.uow:
            rows = self.uow.pedidos.get_ingresos_por_forma_pago(desde, hasta)
            return [
                IngresosResponse(
                    forma_pago_codigo=row.forma_pago_codigo,
                    total=row.total or 0,
                    cantidad=row.cantidad
                ) for row in rows
            ]

    def get_resumen_kpis(self, desde: date, hasta: date) -> ResumenResponse:
        with self.uow:
            # Datos del periodo completo
            periodo_data = self.uow.pedidos.get_ventas_periodo(desde, hasta, 'day')
            ingresos_totales = sum(row.total_ventas for row in periodo_data) if periodo_data else 0
            cant_pedidos = sum(row.cantidad_pedidos for row in periodo_data) if periodo_data else 0
            
            ticket_promedio = (ingresos_totales / cant_pedidos) if cant_pedidos > 0 else 0
            
            # Pedidos activos (Todos menos ENTREGADO y CANCELADO) en ese periodo
            estados_data = self.uow.pedidos.get_pedidos_por_estado(desde, hasta)
            pedidos_activos = sum(row.cantidad for row in estados_data if row.estado_codigo not in ['ENTREGADO', 'CANCELADO'])
            
            return ResumenResponse(
                ventas_hoy=ingresos_totales,
                ticket_promedio=ticket_promedio,
                pedidos_activos=pedidos_activos,
                ingresos_mes=ingresos_totales
            )
