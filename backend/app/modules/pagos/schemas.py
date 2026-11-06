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
