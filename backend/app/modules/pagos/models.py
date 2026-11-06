from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Numeric, BigInteger

class Pago(SQLModel, table=True):
    __tablename__ = "pagos"

#============== PK ================
    id: Optional[int] = Field(default=None, primary_key=True)

#============== FK ================
    pedido_id: int = Field(foreign_key="pedidos.id" , nullable=False)

#============== Local State ================
    estado: str = Field(default="pendiente", max_length=20)

#============== MercadoPago Preference (Checkout PRO) ===============
    mp_preference_id: Optional[str] = Field(default=None, max_length=255)
    mp_init_point: Optional[str] = Field(default=None, max_length=500)

#============== MercadoPago Payment API ===============
    mp_payment_id: Optional[int] = Field(default=None, unique=True, sa_type=BigInteger)
    mp_merchant_order_id: Optional[int] = Field(default=None, sa_type=BigInteger)

    mp_status: Optional[str] = Field(default=None, max_length=30)
    mp_status_detail: Optional[str] = Field(default=None, max_length=100)

    external_reference: Optional[str] = Field(default=None, max_length=100)
    idempotency_key: str = Field(max_length=100, unique=True)

    transaction_amount: Decimal = Field(sa_column=Column(Numeric(10,2), nullable=False))
    payment_method_id: Optional[str] = Field(default=None, max_length=50)

#============== Audit ================
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
