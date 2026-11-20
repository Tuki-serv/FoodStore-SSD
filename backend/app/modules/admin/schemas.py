from datetime import date
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, PlainSerializer

# Importe monetario: en JSON viaja como texto decimal con 2 decimales ("1500.00"), nunca como float.
Monto = Annotated[Decimal, PlainSerializer(lambda valor: f"{valor:.2f}", return_type=str, when_used="json")]


class VentasPeriodoItem(BaseModel):
    fecha: date
    total_ventas: Monto
    cantidad_pedidos: int


class ProductoTopItem(BaseModel):
    producto_id: int
    nombre: str
    cantidad_vendida: int
    ingresos: Monto


class PedidosEstadoItem(BaseModel):
    estado_codigo: str
    cantidad: int


class ResumenResponse(BaseModel):
    ventas: int
    ingresos: Monto
    ticket_promedio: Monto
    pedidos_activos: int


class IngresosResponse(BaseModel):
    forma_pago_codigo: str
    total: Monto
    cantidad: int
