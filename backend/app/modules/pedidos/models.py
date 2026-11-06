from typing import Optional  
from decimal import Decimal

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Numeric, CheckConstraint, Text, ForeignKey, Integer
from app.core.mixins.auditable_mixin import UniqueAuditableMixin


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
    usuario_id: int = Field(foreign_key="usuario.id" , nullable=False)
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
