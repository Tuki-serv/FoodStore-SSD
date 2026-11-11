import uuid
import logging
from datetime import datetime, timezone
from collections.abc import Set as AbstractSet
from typing import Callable, Optional
from fastapi import HTTPException
from sqlmodel import Session

import mercadopago
from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.core.permissions import puede_acceder_a_propio

# Importaciones de los modelos y esquemas necesarios
from app.modules.pedidos.models import Pedido
from app.modules.pagos.models import Pago
from app.modules.pagos.decision_webhook import Accion, decidir_transicion_pago
from app.modules.pagos.firma_webhook import verificar_firma_webhook
from app.modules.pagos.schemas import NotificacionWebhook, PagoCrearResponse, PagoEstadoResponse
from app.modules.pagos.unit_of_work import PagoUnitOfWork
from app.modules.pedidos.service import PedidoService, construir_pedido_service

logger = logging.getLogger(__name__)

ESTADO_PAGO_A_DEVOLVER = "a_devolver"
ROLES_PRIVILEGIADOS_PAGOS = frozenset({"ADMIN"})


class PaymentService:
    def __init__(
        self,
        session: Session,
        construir_pedidos: Callable[[Session], PedidoService] = construir_pedido_service,
    ) -> None:
        self._session = session
        self._construir_pedidos = construir_pedidos

    def _get_mp_access_token(self) -> Optional[str]:
        return settings.MP_ACCESS_TOKEN

    def _obtener_pedido_autorizado(
        self, uow: PagoUnitOfWork, pedido_id: int, usuario_id: int, roles: AbstractSet[str]
    ) -> Pedido:
        """Pedido sobre el que el usuario puede operar pagos: 404 si no existe o está eliminado, 403 si no es suyo ni ADMIN."""
        pedido = uow.pedidos.get_by_id(pedido_id)
        if pedido is None or pedido.deleted_at is not None:
            raise AppError(404, "HTTP_404", "Pedido no encontrado")
        if not puede_acceder_a_propio(pedido.usuario_id, usuario_id, roles, ROLES_PRIVILEGIADOS_PAGOS):
            raise AppError(403, "HTTP_403", "No tenés acceso a este pedido")
        return pedido

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

    def crear_pago(self, pedido_id: int, usuario_id: int, roles: AbstractSet[str]) -> PagoCrearResponse:
        with PagoUnitOfWork(self._session) as uow:
            pedido = self._obtener_pedido_autorizado(uow, pedido_id, usuario_id, roles)
            total = pedido.total

        self._exigir_configuracion_mp()

        back_urls = {
            "success": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/success",
            "failure": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/failure",
            "pending": f"{settings.BACKEND_PUBLIC_URL}/api/v1/pagos/redirect/{pedido_id}/pending",
        }

        try:
            mp_data = self._crear_preferencia_mp(
                monto=total,
                titulo=f"Pedido #{pedido_id} - FoodStore",
                pedido_id=pedido_id,
                back_urls=back_urls,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))

        with PagoUnitOfWork(self._session) as uow:
            pago = Pago(
                pedido_id=pedido_id,
                transaction_amount=total,
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

    # ─── Webhook de MercadoPago (D4–D7): firma → tópico/id → consulta a MP → transacción única ────────────────
    @staticmethod
    def _resolver_tipo_e_id(notificacion: NotificacionWebhook) -> tuple[str | None, int | None]:
        """Tópico (`type`/`topic`) e id del pago: `data.id` de la query manda; si falta, el del cuerpo; si difieren, 400."""
        query, body = notificacion.query, notificacion.body
        topic = query.get("type") or query.get("topic") or body.get("type") or body.get("topic")
        data_body = body.get("data")
        id_cuerpo = data_body.get("id") if isinstance(data_body, dict) else None
        id_query = query.get("data.id")
        if id_query and id_cuerpo and str(id_query) != str(id_cuerpo):
            raise AppError(400, "HTTP_400", "El id del pago de la query y del cuerpo no coinciden")
        crudo = id_query or id_cuerpo
        if not crudo:
            return topic, None
        try:
            return topic, int(crudo)
        except (TypeError, ValueError):
            raise AppError(400, "HTTP_400", "Id de pago inválido") from None

    @staticmethod
    def _estado_local_para(estado_mp: str | None) -> str | None:
        if estado_mp == "approved":
            return "aprobado"
        if estado_mp in ("rejected", "cancelled", "refunded", "charged_back"):
            return "rechazado"
        if estado_mp in ("pending", "in_process", "authorized"):
            return "pendiente"
        return None

    @staticmethod
    def _resolver_pago_bloqueado(uow: PagoUnitOfWork, mp_payment_id: int, mp_info: dict) -> Pago | None:
        """Pago local (con la fila bloqueada): por `mp_payment_id`, luego `external_reference`, luego `merchant_order_id`."""
        pago = uow.pagos.get_by_mp_payment_id_for_update(mp_payment_id)
        if pago is None and mp_info.get("external_reference"):
            try:
                pago = uow.pagos.get_ultimo_by_pedido_for_update(int(mp_info["external_reference"]))
            except ValueError:
                pago = None
        if pago is None and mp_info.get("mp_merchant_order_id"):
            pago = uow.pagos.get_by_mp_merchant_order_id_for_update(int(mp_info["mp_merchant_order_id"]))
        return pago

    async def procesar_webhook(self, notificacion: NotificacionWebhook) -> dict:
        secreto = settings.MP_WEBHOOK_SECRET
        if not secreto:
            raise AppError(503, "HTTP_503", "MercadoPago no configurado: falta MP_WEBHOOK_SECRET")
        verificar_firma_webhook(
            notificacion.x_signature, notificacion.x_request_id, notificacion.query.get("data.id"), secreto
        )

        topic, mp_payment_id = self._resolver_tipo_e_id(notificacion)
        if topic != "payment" or mp_payment_id is None:
            return {"status": "ignored"}
        if not self._get_mp_access_token():
            raise AppError(503, "HTTP_503", "MercadoPago no configurado: falta MP_ACCESS_TOKEN")

        mp_info = self._consultar_pago_mp(mp_payment_id)
        estado_mp = mp_info.get("mp_status")
        nuevo_estado = self._estado_local_para(estado_mp)
        if nuevo_estado is None:
            return {"status": "ignored"}

        with PagoUnitOfWork(self._session) as uow:
            pago = self._resolver_pago_bloqueado(uow, mp_payment_id, mp_info)
            if pago is None:
                return {"status": "ignored", "reason": "Pago not found"}
            if (
                decidir_transicion_pago(pago.estado, pago.mp_payment_id, mp_payment_id, nuevo_estado)
                == Accion.YA_PROCESADO
            ):
                return {"status": "already_processed"}

            pago.mp_payment_id = mp_payment_id
            pago.mp_status = estado_mp
            pago.mp_status_detail = mp_info.get("mp_status_detail")
            pago.mp_merchant_order_id = mp_info.get("mp_merchant_order_id")
            pago.estado = nuevo_estado
            pago.updated_at = datetime.now(timezone.utc)
            uow.pagos.update(pago)

            if nuevo_estado != "aprobado":
                return {"status": "processed", "pago_id": pago.id}
            return self._confirmar_pedido_del_pago(uow, pago)

    def _confirmar_pedido_del_pago(self, uow: PagoUnitOfWork, pago: Pago) -> dict:
        """Confirmación automática (actor Sistema, misma transacción). Lo que el Sistema no puede confirmar queda `a_devolver`."""
        try:
            pedido = self._construir_pedidos(self._session).confirmar_por_pago_aprobado(pago.pedido_id)
        except AppError as exc:
            if exc.code != ErrorCode.INVALID_TRANSITION:
                raise
            pago.estado = ESTADO_PAGO_A_DEVOLVER  # cobrado sin pedido que lo respalde (OQ-1)
            uow.pagos.update(pago)
            return {"status": "processed", "pago_id": pago.id}
        if pedido.estado_codigo == "CANCELADO":  # pagado sin stock: queda para devolución manual
            pago.estado = ESTADO_PAGO_A_DEVOLVER
            uow.pagos.update(pago)
        return {"status": "processed", "pago_id": pago.id, "pedido_actualizado": pedido}

    def _consultar_pago_mp(self, payment_id: int) -> dict:
        """Consulta el pago a MercadoPago (borde externo); un fallo del proveedor es 502 (reintentable)."""
        sdk = mercadopago.SDK(self._get_mp_access_token())
        try:
            result = sdk.payment().get(payment_id)
        except (OSError, ValueError) as exc:  # red (requests.RequestException es OSError) o respuesta ilegible
            logger.warning("Error al consultar el pago %s en MercadoPago: %s", payment_id, exc)
            raise AppError(502, "HTTP_502", "No se pudo consultar el pago en MercadoPago") from exc

        if result.get("status") != 200:
            logger.warning("MercadoPago respondió %s al consultar el pago %s", result.get("status"), payment_id)
            raise AppError(502, "HTTP_502", "No se pudo consultar el pago en MercadoPago")

        response = result.get("response", {})
        return {
            "mp_payment_id": response.get("id"),
            "mp_status": response.get("status"),
            "mp_status_detail": response.get("status_detail"),
            "mp_merchant_order_id": response.get("order", {}).get("id") if "order" in response else response.get("merchant_order_id"),
            "external_reference": response.get("external_reference"),
        }

    def obtener_pago(self, pedido_id: int, usuario_id: int, roles: AbstractSet[str]) -> PagoEstadoResponse:
        with PagoUnitOfWork(self._session) as uow:
            self._obtener_pedido_autorizado(uow, pedido_id, usuario_id, roles)
            pago_local = uow.pagos.get_ultimo_by_pedido(pedido_id)
            return PagoEstadoResponse(
                estado=pago_local.estado if pago_local else None,
                pedido_id=pedido_id,
            )
