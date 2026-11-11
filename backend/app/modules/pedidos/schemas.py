from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Optional, List
from datetime import date, datetime

from sqlmodel import SQLModel, Field
from pydantic import ConfigDict, ValidationInfo, field_validator
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


EstadoPedidoCodigo = Literal["PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO", "CANCELADO"]


@dataclass(frozen=True)
class FiltrosPedidos:
    """Filtros opcionales del listado (query params): estado y rango de fechas de creación, inclusivo, en UTC."""
    estado: EstadoPedidoCodigo | None = None
    desde: date | None = None
    hasta: date | None = None
