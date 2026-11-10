import uuid
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from sqlmodel import Session

import mercadopago
from app.core.config import settings

# Importaciones de los modelos y esquemas necesarios
from app.modules.pedidos.models import Pedido
from app.modules.pagos.models import Pago
from app.modules.pagos.schemas import PagoCrearResponse, PagoEstadoResponse
from app.modules.pagos.unit_of_work import PagoUnitOfWork
from app.modules.pedidos.service import PedidoService
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.pedidos.schemas import PedidoCambioEstado

logger = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, session: Session) -> None:
        self._session = session

    def _get_mp_access_token(self) -> Optional[str]:
        return settings.MP_ACCESS_TOKEN

    def _exigir_configuracion_mp(self) -> None:
        """503 (formato uniforme) si falta alguna variable necesaria para crear un pago; nombra las faltantes."""
        requeridas = (
            ("MP_ACCESS_TOKEN", self._get_mp_access_token()),
            ("MP_NOTIFICATION_URL", settings.MP_NOTIFICATION_URL),
            ("BACKEND_PUBLIC_URL", settings.BACKEND_PUBLIC_URL),
        )
        faltantes = [nombre for nombre, valor in requeridas if not valor]
        if faltantes:
            raise HTTPException(
                status_code=503,
                detail=f"MercadoPago no configurado: faltan {', '.join(faltantes)}",
            )

    def _crear_preferencia_mp(self, monto: float, titulo: str, pedido_id: int, back_urls: dict) -> dict:
        access_token = self._get_mp_access_token()
        if not access_token:
            raise RuntimeError(
                "MercadoPago no está configurado. Revisa tu .env")

        sdk = mercadopago.SDK(access_token)
        preference_data = {
            "items": [{
                "title": titulo,
                "quantity": 1,
                "unit_price": float(monto),
                "currency_id": "ARS",
            }],
            "external_reference": str(pedido_id),
            "back_urls": back_urls,
            "auto_return": "approved",
            "notification_url": settings.MP_NOTIFICATION_URL
        }

        result = sdk.preference().create(preference_data)

        if result.get("status") not in (200, 201):
            error_detail = result.get("response", {})
            raise RuntimeError(f"Error MP: {error_detail}")

        response = result.get("response", {})
        return {
            "preference_id": response.get("id"),
            "init_point": response.get("init_point"),
        }

    def _consultar_pago_mp(self, payment_id: int) -> dict:
        access_token = self._get_mp_access_token()
        if not access_token:
            raise RuntimeError("MP no configurado")

        sdk = mercadopago.SDK(access_token)
        result = sdk.payment().get(payment_id)

        if result.get("status") != 200:
            error_detail = result.get("response", {})
            raise RuntimeError(
                f"Error al consultar pago {payment_id}: {error_detail}")

        response = result.get("response", {})
        return {
            "mp_payment_id": response.get("id"),
            "mp_status": response.get("status"),
            "mp_status_detail": response.get("status_detail"),
            "mp_merchant_order_id": response.get("order", {}).get("id") if "order" in response else response.get("merchant_order_id"),
            "external_reference": response.get("external_reference"),
        }

    def crear_pago(self, pedido_id: int) -> PagoCrearResponse:
        pedido = self._session.get(Pedido, pedido_id)
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        self._exigir_configuracion_mp()

        back_urls = {
            "success": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/success",
            "failure": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/failure",
            "pending": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/pending",
        }

        try:
            mp_data = self._crear_preferencia_mp(
                monto=pedido.total,
                titulo=f"Pedido #{pedido_id} - FoodStore",
                pedido_id=pedido_id,
                back_urls=back_urls,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

        with PagoUnitOfWork(self._session) as uow:
            pago = Pago(
                pedido_id=pedido_id,
                transaction_amount=pedido.total,
                estado="pendiente",
                mp_preference_id=mp_data["preference_id"],
                mp_init_point=mp_data.get("init_point"),
                idempotency_key=str(uuid.uuid4()),
            )
            uow.pagos.add(pago)

            return PagoCrearResponse(
                pago_id=pago.id,
                preference_id=mp_data["preference_id"],
                init_point=mp_data.get("init_point"),
                public_key=settings.MP_PUBLIC_KEY,
            )

    async def procesar_webhook(self, data: dict, query_params: Optional[dict] = None) -> dict:
        if not data and query_params:
            data = query_params

        topic = data.get("type") or data.get("topic")
        data_id = data.get("data_id") or (data.get("data") or {}).get("id")
        payment_id = data.get("id")

        if not data_id and query_params:
            data_id = query_params.get("data.id") or query_params.get("id")
        if not topic and query_params:
            topic = query_params.get("topic") or query_params.get("type")

        pago_mp_id = data_id or payment_id

        if not pago_mp_id or topic != "payment":
            return {"status": "ignored"}

        try:
            mp_info = self._consultar_pago_mp(int(pago_mp_id))
            estado_mp = mp_info.get("mp_status")
            external_reference = mp_info.get("external_reference")

            if estado_mp == "approved":
                nuevo_estado = "aprobado"
            elif estado_mp in ("rejected", "cancelled", "refunded", "charged_back"):
                nuevo_estado = "rechazado"
            elif estado_mp in ("pending", "in_process", "authorized"):
                nuevo_estado = "pendiente"
            else:
                return {"status": "ignored"}

            with PagoUnitOfWork(self._session) as uow:
                pago = None
                if external_reference:
                    try:
                        pedido_id = int(external_reference)
                        pago = uow.pagos.get_ultimo_by_pedido(pedido_id)
                    except ValueError:
                        pass

                if not pago:
                    pago = uow.pagos.get_by_mp_payment_id(int(pago_mp_id))

                if not pago and mp_info.get("mp_merchant_order_id"):
                    pago = uow.pagos.get_by_mp_merchant_order_id(
                        int(mp_info["mp_merchant_order_id"]))

                if not pago:
                    return {"status": "ignored", "reason": "Pago not found"}

                if pago.estado != "pendiente":
                    return {"status": "already_processed"}

                pago.mp_payment_id = int(pago_mp_id)
                pago.mp_status = estado_mp
                pago.mp_status_detail = mp_info.get("mp_status_detail")
                pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
                pago.estado = nuevo_estado
                pago.updated_at = datetime.now(timezone.utc)
                uow.pagos.update(pago)

                if nuevo_estado == "aprobado":

                    # Usamos la misma metodología (PedidoService para la DB y la FSM)
                    pedido_svc = PedidoService(PedidoUnitOfWork(uow._session))
                    try:
                        pedido = uow._session.get(Pedido, pago.pedido_id)
                        user_id_to_log = pedido.usuario_id if pedido else None

                        resultado_pedido = await pedido_svc.cambiar_estado_pedido(
                            pedido_id=pago.pedido_id,
                            data=PedidoCambioEstado(
                                estado_hacia="CONFIRMADO",
                                motivo="Pago confirmado via Webhook MercadoPago"
                            ),
                            usuario_id=user_id_to_log,  # Use the order's user to avoid FK error
                            roles=frozenset({"ADMIN"})
                        )
                        
                        # TODO: Rúbrica MP (Webhook que procesa topic=payment, avanza pedido y notifica WS).
                        # Aquí también debería invocarse el broadcast_pedido() o send_to_room() de WSManager
                        # para informar al frontend en tiempo real del pago exitoso.
                        
                        return {"status": "processed", "pago_id": pago.id, "pedido_actualizado": resultado_pedido}
                    except Exception as e:
                        logger.warning(
                            f"Error al avanzar estado del pedido vía webhook: {e}")

            return {"status": "processed", "pago_id": pago.id}
        except Exception as e:
            logger.exception("Error procesando webhook MP")
            return {"status": "error", "reason": str(e)}

    def obtener_pago(self, pedido_id: int) -> PagoEstadoResponse:
        with PagoUnitOfWork(self._session) as uow:
            pago_local = uow.pagos.get_ultimo_by_pedido(pedido_id)
            return PagoEstadoResponse(
                estado=pago_local.estado if pago_local else None,
                pedido_id=pedido_id,
            )
