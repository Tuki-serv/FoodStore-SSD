from typing import Literal, Optional

from sqlmodel import SQLModel
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
    payment_type_id: Literal["credit_card", "debit_card"]  # `additionalData.paymentTypeId` del brick
    installments: int = Field(ge=1)
    issuer_id: Optional[int] = None  # el brick lo entrega; Orders no lo admite, así que se acepta y no se reenvía
    payer: PagadorRequest


class PagoCrearResponse(BaseModel):
    pago_id: int
    pedido_id: int
    estado: str
    mp_order_id: Optional[str] = None
    mp_payment_id: Optional[str] = None
    mp_status: Optional[str] = None
    mp_status_detail: Optional[str] = None


class PagoEstadoResponse(BaseModel):
    pedido_id: int
    pago_id: Optional[int] = None
    estado: Optional[str] = None
    mp_status: Optional[str] = None
    mp_status_detail: Optional[str] = None


class ConfiguracionPagosResponse(BaseModel):
    """Configuración pública para el brick `CardPayment`: solo la clave pública (nunca access token ni secreto)."""

    public_key: str


class NotificacionWebhook(BaseModel):
    """Notificación de MercadoPago tal como llega: headers de firma, query string y cuerpo (JSON o form)."""

    x_signature: Optional[str] = None
    x_request_id: Optional[str] = None
    query: dict[str, str] = {}
    body: dict = {}


class WebhookRespuesta(BaseModel):
    """Cuerpo de toda respuesta 200 del webhook: solo qué se hizo con la notificación, sin datos del pago ni del pedido."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["processed", "already_processed", "ignored"]


class FormaPagoRead(SQLModel):
    codigo: str
    descripcion: str
