from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlmodel import SQLModel, Field
from sqlalchemy import (
    ARRAY, BigInteger, Column, Numeric, CheckConstraint, Text, ForeignKey, Integer, SmallInteger, String,
)
from app.core.mixins.auditable_mixin import UniqueAuditableMixin
from app.core.timestamps import aware_datetime_field

class Pedido(UniqueAuditableMixin,SQLModel, table=True):
    __tablename__ = "pedidos"

    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="chk_pedido_subtotal_positivo"),
        CheckConstraint("descuento >= 0", name="chk_pedido_descuento_positivo"),
        CheckConstraint("costo_envio >= 0", name="chk_pedido_costo_envio_positivo"),
        CheckConstraint("total >= 0", name="chk_pedido_total_positivo"),
    )

#============== PK ================
    id: Optional[int] = Field(default=None, primary_key=True)

#============== FK's ================
    usuario_id: int = Field(foreign_key="usuario.id", nullable=False, sa_type=BigInteger)
    direccion_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("direccion_entrega.id", ondelete="SET NULL"), nullable=True))
    estado_codigo: str = Field(max_length=20, foreign_key="estado_pedido.codigo", nullable=False)
    forma_pago_codigo: str = Field(max_length=20, nullable=False, foreign_key="forma_pago.codigo")

#============== Snapshot monetario ================
    subtotal: Decimal = Field(sa_column= Column(Numeric(10, 2), nullable= False))
    descuento: Decimal = Field(default=Decimal("0.00"), sa_column= Column(Numeric(10, 2), nullable= False))
    costo_envio: Decimal = Field(default=Decimal("50.00"), sa_column= Column(Numeric(10, 2), nullable= False))
    total: Decimal = Field(sa_column= Column(Numeric(10, 2), nullable= False))

#============== Atributos ================
    notas: Optional[str] = Field(default=None, sa_column=Column(Text))


class EstadoPedido(SQLModel, table=True):
    __tablename__ = "estado_pedido"

    codigo: str = Field(primary_key=True, max_length=20)
    descripcion: str = Field(max_length=255, nullable=False)
    orden: int = Field(nullable=False)
    es_terminal: bool = Field(default=False, nullable=False)



class HistorialEstadoPedido(SQLModel, table=True):
    __tablename__ = "historial_estado_pedido"

#============== PK ================ 
    id: Optional[int] = Field(default=None, primary_key=True)

#============== FK's ================ 
    pedido_id: int = Field(sa_column=Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False))
    estado_desde: Optional[str] = Field( default=None, foreign_key="estado_pedido.codigo")
    estado_hacia: str = Field(foreign_key="estado_pedido.codigo", nullable=False)
    usuario_id: Optional[int] = Field(default=None, foreign_key="usuario.id", sa_type=BigInteger)

#============== Atributos ================ 
    motivo: Optional[str] = Field(default=None, sa_column=Column(Text))

#============== Audit ================ 
    created_at: datetime = aware_datetime_field(default_now=True)



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
    created_at: datetime = aware_datetime_field(default_now=True)
