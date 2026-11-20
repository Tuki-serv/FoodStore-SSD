from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import List

from app.modules.admin.schemas import (
    IngresosResponse,
    PedidosEstadoItem,
    ProductoTopItem,
    ResumenResponse,
    VentasPeriodoItem,
)
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork

_CENTAVO = Decimal("0.01")


class EstadisticasService:
    def __init__(self, uow: PedidoUnitOfWork):
        self.uow = uow

    def ventas_por_periodo(self, desde: date, hasta: date, agrupacion: str) -> List[VentasPeriodoItem]:
        with self.uow:
            rows = self.uow.pedidos.ventas_por_periodo(desde, hasta, agrupacion)
            return [
                VentasPeriodoItem(fecha=r.fecha, total_ventas=r.total_ventas, cantidad_pedidos=r.cantidad_pedidos)
                for r in rows
            ]

    def productos_top(self, desde: date, hasta: date, limit: int) -> List[ProductoTopItem]:
        with self.uow:
            rows = self.uow.detalles.productos_top(desde, hasta, limit)
            return [
                ProductoTopItem(
                    producto_id=r.producto_id, nombre=r.nombre, cantidad_vendida=r.cantidad_vendida, ingresos=r.ingresos
                )
                for r in rows
            ]

    def pedidos_por_estado(self, desde: date, hasta: date) -> List[PedidosEstadoItem]:
        with self.uow:
            rows = self.uow.pedidos.pedidos_por_estado(desde, hasta)
            return [PedidosEstadoItem(estado_codigo=r.estado_codigo, cantidad=r.cantidad) for r in rows]

    def ingresos_por_forma_pago(self, desde: date, hasta: date) -> List[IngresosResponse]:
        with self.uow:
            rows = self.uow.pedidos.ingresos_por_forma_pago(desde, hasta)
            return [
                IngresosResponse(forma_pago_codigo=r.forma_pago_codigo, total=r.total, cantidad=r.cantidad) for r in rows
            ]

    def resumen(self, desde: date, hasta: date) -> ResumenResponse:
        with self.uow:
            resumen = self.uow.pedidos.resumen_ventas(desde, hasta)
            ingresos = Decimal(resumen.ingresos)
            ticket = (ingresos / resumen.ventas).quantize(_CENTAVO, ROUND_HALF_UP) if resumen.ventas else Decimal("0")
            return ResumenResponse(
                ventas=resumen.ventas,
                ingresos=ingresos,
                ticket_promedio=ticket,
                pedidos_activos=self.uow.pedidos.contar_activos(),
            )
