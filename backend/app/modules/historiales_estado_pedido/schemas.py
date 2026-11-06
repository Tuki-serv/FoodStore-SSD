from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel
class HistorialEstadoPedidoRead(SQLModel):
    id: int
    pedido_id: int
    estado_desde: Optional[str] = None
    estado_hacia: str
    motivo: Optional[str] = None
    usuario_id: Optional[int] = None
    created_at: datetime
