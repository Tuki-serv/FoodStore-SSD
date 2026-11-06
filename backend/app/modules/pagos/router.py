import logging
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlmodel import Session

from app.core.database import get_session
from app.modules.pagos.schemas import CrearPagoRequest, PagoCrearResponse, PagoEstadoResponse
from app.modules.pagos.service import PaymentService

from fastapi.responses import RedirectResponse
from app.core.config import settings
import urllib.parse
from app.core.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/pagos", tags=["pagos"])

def get_payment_service(session: Session = Depends(get_session)) -> PaymentService:
    return PaymentService(session)


# 1. Endpoint para crear el pago (La Ventanilla de Cobro)
@router.post("/crear", response_model=PagoCrearResponse, status_code=201)
def crear_pago(
    data: CrearPagoRequest,
    svc: PaymentService = Depends(get_payment_service),
):
    """
    Rúbrica: Crea pago. En nuestra implementación (Checkout PRO),
    genera la preferencia y devuelve el init_point para redirigir.
    """
    return svc.crear_pago(data.pedido_id)


# 2. Endpoint para escuchar a MercadoPago (La Puerta Trasera)
@router.post("/webhook", status_code=200)
async def webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    svc: PaymentService = Depends(get_payment_service),
):
    """
    Rúbrica: Endpoint IPN de MercadoPago. Actualiza estado del pago y del pedido.
    """
    try:
        query_params = dict(request.query_params)
        
        # MercadoPago a veces manda JSON y a veces Form-Data, hay que atajar los dos:
        if request.headers.get("content-type", "").startswith("application/json"):
            data = await request.json()
        else:
            data = dict(await request.form())
            
        result = await svc.procesar_webhook(data, query_params=query_params)
        
        # Misma metodología que PedidoRouter: el router dispara el WebSocket
        if result.get("status") == "processed" and "pedido_actualizado" in result:
            pedido = result["pedido_actualizado"]

            
            EVENTOS_WS = {
                "CONFIRMADO": "PEDIDO_CONFIRMADO",
                "EN_PREP": "PEDIDO_EN_PREPARACION",
                "CANCELADO": "PEDIDO_CANCELADO",
            }
            evento = EVENTOS_WS.get(pedido.estado_codigo, "ESTADO_ACTUALIZADO")
            
            background_tasks.add_task(
                manager.send_to_room, "role:KDS", evento, pedido.model_dump(mode="json")
            )
            background_tasks.add_task(
                manager.send_to_room, f"pedido:{pedido.id}", evento, pedido.model_dump(mode="json")
            )
            
        return result
    except Exception as e:
        logger.exception("Error en webhook MP")
        return {"status": "error", "reason": str(e)}


# 3. Endpoint para consultar el estado (El Mostrador de Consultas)
@router.get("/{pedido_id}", response_model=PagoEstadoResponse)
def consultar_pago(
    pedido_id: int,
    svc: PaymentService = Depends(get_payment_service),
):
    """
    Rúbrica: Consulta el pago asociado a un pedido.
    """
    return svc.obtener_pago(pedido_id)

# 4. Endpoint para redirigir de vuelta al frontend (El Puente)
@router.get("/redirect/{pedido_id}/{status}")
def mp_redirect(pedido_id: int, status: str, request: Request):
    """
    MercadoPago nos manda de vuelta acá (vía ngrok).
    Agarramos los query params de MP y se los pasamos al frontend en la redirección.
    """
    frontend_url = settings.FRONTEND_URL
    if not frontend_url:
        raise HTTPException(status_code=503, detail="FRONTEND_URL no configurada")
    
    # Transformamos el diccionario de query params a un string (ej: payment_id=123&status=approved)
    query_params = dict(request.query_params)
    query_string = urllib.parse.urlencode(query_params)
    
    # Armamos la ruta a nuestra nueva página, pasándole el status en la URL también
    redirect_url = f"{frontend_url}/payment/feedback/{pedido_id}?status={status}"
    
    if query_string:
        redirect_url += f"&{query_string}"
        
    return RedirectResponse(url=redirect_url)
