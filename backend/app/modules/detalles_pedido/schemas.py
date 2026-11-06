from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlmodel import SQLModel, Field

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
