from decimal import Decimal
from typing import Optional, List
from datetime import datetime

from sqlmodel import SQLModel, Field
from pydantic import model_validator
from app.modules.detalles_pedido.schemas import (
    DetallePedidoCreate,
    DetallePedidoRead,
)

class PedidoCreate(SQLModel):
    direccion_id: Optional[int] = Field(
        default=None,
        description="ID de dirección de entrega."
    )
    forma_pago_codigo: str = Field(
        ...,
        max_length=20,
        description="Código de forma de pago."
    )
    notas: Optional[str] = Field(
        default=None,
        description="Notas opcionales."
    )
    items: List[DetallePedidoCreate] = Field(
        ...,
        min_length=1,
        description="Items del pedido."
    )

class PedidoCambioEstado(SQLModel):
    estado_hacia: str = Field(
        ...,
        max_length=20,
        description="Nuevo estado del pedido"
    )
    motivo: Optional[str] = Field(
        default=None,
        description="Motivo del cambio. Obligatorio si se cancela."
    )
    @model_validator(mode="after")
    def validar_motivo_cancelacion(self):
        if self.estado_hacia == "CANCELADO" and not self.motivo:
            raise ValueError("El motivo es obligatorio si el estado_hacia es CANCELADO")
        return self


class PedidoRead(SQLModel):
    id: int
    estado_codigo: str
    forma_pago_codigo: str
    subtotal: Decimal
    descuento: Decimal
    costo_envio: Decimal
    total: Decimal
    notas: Optional[str] = None
    created_at: datetime

class PedidoReadFull(PedidoRead):
    items: List[DetallePedidoRead] = Field(default_factory=list)

class PedidoReadAdmin(PedidoReadFull):
    cliente_nombre: str
    
class PedidoList(SQLModel):
    data: List[PedidoRead]
    total: int

class PedidoListAdmin(SQLModel):
    data: List[PedidoReadAdmin]
    total: int
