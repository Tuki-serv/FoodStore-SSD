from decimal import Decimal
from typing import Optional, List
from datetime import datetime

from sqlmodel import SQLModel, Field
from pydantic import ConfigDict, ValidationInfo, field_validator


class EstadoPedidoRead(SQLModel):
    codigo: str



class HistorialEstadoPedidoRead(SQLModel):
    id: int
    pedido_id: int
    estado_desde: Optional[str] = None
    estado_hacia: str
    motivo: Optional[str] = None
    usuario_id: Optional[int] = None
    created_at: datetime



class DetallePedidoCreate(SQLModel):
    producto_id: int = Field(..., description="ID del producto")
    cantidad: int = Field(..., ge=1, description="Cantidad del producto")
    personalizacion: Optional[List[int]] = Field(default=None, description="ID de la personalización")

class DetallePedidoRead(SQLModel):
    pedido_id: int
    producto_id: int

    cantidad: int

    nombre_snapshot: str
    precio_snapshot: Decimal
    subtotal_snapshot: Decimal
    
    personalizacion: Optional[List[int]] = None
    personalizacion_snapshot: Optional[List[str]] = None
    created_at: datetime


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
    model_config = ConfigDict(validate_default=True)  # valida también el motivo omitido

    nuevo_estado: str = Field(
        ...,
        max_length=20,
        description="Nuevo estado del pedido"
    )
    motivo: Optional[str] = Field(
        default=None,
        description="Motivo del cambio. Obligatorio si se cancela."
    )

    # field_validator (no model_validator): el 422 sale con field="motivo".
    @field_validator("motivo", mode="after")
    @classmethod
    def validar_motivo_cancelacion(cls, motivo: Optional[str], info: ValidationInfo) -> Optional[str]:
        if info.data.get("nuevo_estado") == "CANCELADO" and not (motivo and motivo.strip()):
            raise ValueError("El motivo es obligatorio si el nuevo_estado es CANCELADO")
        return motivo


class PedidoCancelacion(SQLModel):
    """Body opcional de `DELETE /pedidos/{id}`: sin motivo (o vacío) se usa el motivo por defecto del service."""
    motivo: Optional[str] = Field(default=None, description="Motivo de la cancelación (opcional).")


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

class PedidoResumen(PedidoRead):
    """Elemento del listado de pedidos: el pedido más su dueño, sin ítems."""
    usuario_id: int
    cliente_nombre: str


class PedidoDetalle(PedidoResumen):
    """Detalle completo: el resumen más la dirección de entrega y los ítems."""
    direccion_id: Optional[int] = None
    items: List[DetallePedidoRead] = Field(default_factory=list)
