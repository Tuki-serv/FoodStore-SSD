from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class IdentificacionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(min_length=1)
    number: str = Field(min_length=1)


class PagadorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    identification: Optional[IdentificacionRequest] = None


class CrearPagoRequest(BaseModel):
    """Lo que entrega el brick `CardPayment`. Cualquier otro campo (número, CVV, vencimiento) se rechaza: PCI SAQ-A."""

    model_config = ConfigDict(extra="forbid")

    pedido_id: int
    token: str = Field(min_length=1)
    payment_method_id: str = Field(min_length=1)
    installments: int = Field(ge=1)
    issuer_id: Optional[int] = None
    payer: PagadorRequest


class PagoCrearResponse(BaseModel):
    pago_id: int
    pedido_id: int
    estado: str
    mp_payment_id: Optional[int] = None
    mp_status: Optional[str] = None
    mp_status_detail: Optional[str] = None


class PagoEstadoResponse(BaseModel):
    pedido_id: int
    pago_id: Optional[int] = None
    estado: Optional[str] = None
    mp_status: Optional[str] = None
    mp_status_detail: Optional[str] = None


class NotificacionWebhook(BaseModel):
    """Notificación de MercadoPago tal como llega: headers de firma, query string y cuerpo (JSON o form)."""

    x_signature: Optional[str] = None
    x_request_id: Optional[str] = None
    query: dict[str, str] = {}
    body: dict = {}
