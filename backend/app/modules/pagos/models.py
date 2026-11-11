from typing import Optional
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Numeric, BigInteger, UniqueConstraint, Uuid

from app.core.timestamps import aware_datetime_field

class Pago(SQLModel, table=True):
    __tablename__ = "pagos"
    __table_args__ = (UniqueConstraint("external_reference", name="uq_pagos_external_reference"),)

#============== PK ================
    id: Optional[int] = Field(default=None, primary_key=True)

#============== FK ================
    pedido_id: int = Field(foreign_key="pedidos.id" , nullable=False)

#============== Local State ================
    estado: str = Field(default="pendiente", max_length=20)

#============== MercadoPago Payment API ===============
    mp_payment_id: Optional[int] = Field(default=None, unique=True, sa_type=BigInteger)
    mp_merchant_order_id: Optional[int] = Field(default=None, sa_type=BigInteger)

    mp_status: Optional[str] = Field(default=None, max_length=30)
    mp_status_detail: Optional[str] = Field(default=None, max_length=100)

    # Una referencia por intento de pago: la envía el backend a MercadoPago y el webhook la usa para encontrarlo.
    external_reference: UUID = Field(default_factory=uuid4, sa_type=Uuid, nullable=False)
    idempotency_key: str = Field(max_length=100, unique=True)

    transaction_amount: Decimal = Field(sa_column=Column(Numeric(10,2), nullable=False))
    payment_method_id: Optional[str] = Field(default=None, max_length=50)

#============== Audit ================
    created_at: datetime = aware_datetime_field(default_now=True)
    updated_at: datetime = aware_datetime_field(default_now=True)
