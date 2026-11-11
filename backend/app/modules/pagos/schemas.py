from pydantic import BaseModel
from typing import Optional

class CrearPagoRequest(BaseModel):
    pedido_id: int

class PagoCrearResponse(BaseModel):
    pago_id: int
    preference_id: str
    init_point: Optional[str] = None
    public_key: Optional[str] = None

class PagoEstadoResponse(BaseModel):
    estado: Optional[str]
    pedido_id: int


class NotificacionWebhook(BaseModel):
    """Notificación de MercadoPago tal como llega: headers de firma, query string y cuerpo (JSON o form)."""

    x_signature: Optional[str] = None
    x_request_id: Optional[str] = None
    query: dict[str, str] = {}
    body: dict = {}
