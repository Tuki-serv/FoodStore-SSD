from typing import Optional  
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, ForeignKey, Integer


class HistorialEstadoPedido(SQLModel, table=True):
    __tablename__ = "historial_estado_pedido"

#============== PK ================ 
    id: Optional[int] = Field(default=None, primary_key=True)

#============== FK's ================ 
    pedido_id: int = Field(sa_column=Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False))
    estado_desde: Optional[str] = Field( default=None, foreign_key="estado_pedido.codigo")
    estado_hacia: str = Field(foreign_key="estado_pedido.codigo", nullable=False)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id")

#============== Atributos ================ 
    motivo: Optional[str] = Field(default=None, sa_column=Column(Text))

#============== Audit ================ 
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
