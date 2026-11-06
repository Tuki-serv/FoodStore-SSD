from sqlalchemy import ARRAY
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Numeric, CheckConstraint, ForeignKey, Integer, SmallInteger, String

class DetallePedido(SQLModel, table=True):
    __tablename__ = "detalle_pedido" 

    __table_args__ = (
        CheckConstraint("cantidad >= 1", name="chk_detalle_cantidad_positiva"),
        CheckConstraint("precio_snapshot >= 0", name="chk_detalle_precio_positivo"),
        CheckConstraint("subtotal_snapshot >= 0", name="chk_detalle_subtotal_positivo")
    )

#============== PK ================ 
    id: Optional[int] = Field(default=None, primary_key=True)
    pedido_id: int = Field(sa_column=Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False))
    producto_id: int = Field(sa_column=Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False))

#============== Atributos ================ 
    cantidad: int = Field(sa_column=Column(SmallInteger, nullable=False))

#============== Snapshot (inmutable desde creación) ================ 
    nombre_snapshot: str = Field(max_length=200, nullable=False)
    precio_snapshot: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    subtotal_snapshot: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    personalizacion: Optional[List[int]] = Field(default=None, sa_column=Column(ARRAY(Integer))) 
    personalizacion_snapshot: Optional[List[str]] = Field(default=None, sa_column=Column(ARRAY(String)))

#============== Audit ================
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
