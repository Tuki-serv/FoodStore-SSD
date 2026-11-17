from decimal import Decimal
from pydantic import BaseModel
from datetime import date


class VentasPeriodoItem(BaseModel):
    fecha: date
    total_ventas: Decimal
    cantidad_pedidos: int


class ProductoTopItem(BaseModel):
    nombre: str
    ingresos: Decimal
    cantidad_vendida: int


class PedidosEstadoItem(BaseModel):
    estado_codigo: str
    cantidad: int


class ResumenResponse(BaseModel):
    ventas_hoy: Decimal
    ticket_promedio: Decimal
    pedidos_activos: int
    ingresos_mes: Decimal


class IngresosResponse(BaseModel):
    forma_pago_codigo: str
    total: Decimal
    cantidad: int
