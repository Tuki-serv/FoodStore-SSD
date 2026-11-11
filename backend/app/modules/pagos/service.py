import logging
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Optional
from uuid import UUID, uuid4

from sqlmodel import Session

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.core.permissions import puede_acceder_a_propio
from app.modules.pagos.decision_cobro import Intento, decidir_intento
from app.modules.pagos.decision_webhook import Accion, decidir_transicion_pago
from app.modules.pagos.firma_webhook import verificar_firma_webhook
from app.modules.pagos.models import Pago
from app.modules.pagos.pasarela_mp import (
    DatosCobroMP,
    MercadoPagoNoDisponible,
    PagoRechazadoPorMP,
    PasarelaMercadoPago,
    ResultadoMP,
)
from app.modules.pagos.schemas import CrearPagoRequest, NotificacionWebhook, PagoCrearResponse, PagoEstadoResponse
from app.modules.pagos.unit_of_work import PagoUnitOfWork
from app.modules.pedidos.models import Pedido
from app.modules.pedidos.schemas import PedidoDetalle
from app.modules.pedidos.service import PedidoService, construir_pedido_service

logger = logging.getLogger(__name__)

ESTADO_PAGO_PENDIENTE = "pendiente"
ESTADO_PAGO_RECHAZADO = "rechazado"
ESTADO_PAGO_A_DEVOLVER = "a_devolver"
ROLES_PRIVILEGIADOS_PAGOS = frozenset({"ADMIN"})
_MAX_DETALLE_MP = 100  # ancho de `pagos.mp_status_detail`


@dataclass(frozen=True)
class ResultadoCrearPago:
    """Respuesta de `crear_pago` y, si el cobro cambió el pedido, el pedido actualizado (el router dispara el WebSocket)."""

    respuesta: PagoCrearResponse
    pedido_actualizado: PedidoDetalle | None = None


class PaymentService:
    def __init__(
        self,
        session: Session,
        construir_pedidos: Callable[[Session], PedidoService] = construir_pedido_service,
        pasarela: Callable[[str], PasarelaMercadoPago] = PasarelaMercadoPago,
    ) -> None:
        self._session = session
        self._construir_pedidos = construir_pedidos
        self._pasarela = pasarela

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
        )
        faltantes = [nombre for nombre, valor in requeridas if not valor]
        if faltantes:
            raise AppError(503, "HTTP_503", f"MercadoPago no configurado: faltan {', '.join(faltantes)}")

    # ─── Crear pago (Checkout API): T1 guarda el intento → llamada a MercadoPago sin locks → T2 aplica el resultado ───
    def crear_pago(self, datos: CrearPagoRequest, usuario_id: int, roles: AbstractSet[str]) -> ResultadoCrearPago:
        # T1: el bloqueo del pedido serializa dos `crear` concurrentes: el segundo ve el intento del primero.
        with PagoUnitOfWork(self._session) as uow:
            self._obtener_pedido_autorizado(uow, datos.pedido_id, usuario_id, roles)
            pedido = uow.pedidos.get_for_update(datos.pedido_id)
            pagos = uow.pagos.get_by_pedido(pedido.id)
            decision = decidir_intento(pedido.forma_pago_codigo, pedido.estado_codigo, pagos)
            if decision is Intento.NO_PERMITIDO:
                raise AppError(
                    409,
                    ErrorCode.PAYMENT_NOT_ALLOWED,
                    "El pedido no admite un nuevo pago: debe ser MERCADOPAGO, estar PENDIENTE y no tener un pago "
                    "aprobado o en proceso",
                )
            self._exigir_configuracion_mp()
            if decision is Intento.REUTILIZAR:
                intento = pagos[0]  # resultado desconocido: misma `idempotency_key`, MercadoPago no cobra dos veces
            else:
                intento = uow.pagos.add(
                    Pago(
                        pedido_id=pedido.id,
                        transaction_amount=pedido.total,
                        estado=ESTADO_PAGO_PENDIENTE,
                        payment_method_id=datos.payment_method_id,
                        idempotency_key=str(uuid4()),
                    )
                )
            pago_id, clave, referencia = intento.id, intento.idempotency_key, str(intento.external_reference)
            cobro = DatosCobroMP(
                monto=pedido.total,
                token=datos.token,
                payment_method_id=datos.payment_method_id,
                installments=datos.installments,
                issuer_id=datos.issuer_id,
                payer_email=str(datos.payer.email),
                payer_identification=datos.payer.identification.model_dump() if datos.payer.identification else None,
                descripcion=f"Pedido #{pedido.id} - FoodStore",
                external_reference=referencia,
                notification_url=settings.MP_NOTIFICATION_URL,
            )

        pasarela = self._pasarela(self._get_mp_access_token())
        try:
            resultado = pasarela.crear_pago(cobro, clave)
        except MercadoPagoNoDisponible as exc:  # resultado desconocido: el intento queda `pendiente` y reutilizable
            raise AppError(502, "HTTP_502", "No se pudo crear el pago en MercadoPago") from exc
        except PagoRechazadoPorMP as exc:
            self._marcar_rechazado_por_datos(pago_id, exc.causa)
            raise AppError(400, "HTTP_400", "MercadoPago rechazó los datos del pago") from exc

        return self._aplicar_resultado_de_creacion(pago_id, resultado)

    def _marcar_rechazado_por_datos(self, pago_id: int, causa: str) -> None:
        """MercadoPago no creó ningún pago: el intento queda `rechazado` (sin id de MercadoPago) y se reintenta con otro token."""
        with PagoUnitOfWork(self._session) as uow:
            pago = uow.pagos.get_for_update(pago_id)
            if pago is not None and pago.estado == ESTADO_PAGO_PENDIENTE and pago.mp_payment_id is None:
                pago.estado = ESTADO_PAGO_RECHAZADO
                pago.mp_status_detail = causa[:_MAX_DETALLE_MP]
                pago.updated_at = datetime.now(timezone.utc)
                uow.pagos.update(pago)

    def _aplicar_resultado_de_creacion(self, pago_id: int, resultado: ResultadoMP) -> ResultadoCrearPago:
        """T2: relee el intento con bloqueo y aplica lo que MercadoPago informó (si el webhook ya lo procesó, lo refleja)."""
        with PagoUnitOfWork(self._session) as uow:
            pago = uow.pagos.get_for_update(pago_id)
            # Un estado que el webhook no mapea queda registrado sobre un intento `pendiente`.
            nuevo_estado = self._estado_local_para(resultado.mp_status) or ESTADO_PAGO_PENDIENTE
            aplicado = self._aplicar_resultado_mp(uow, pago, resultado, nuevo_estado)
            respuesta = PagoCrearResponse(
                pago_id=pago.id,
                pedido_id=pago.pedido_id,
                estado=pago.estado,
                mp_payment_id=pago.mp_payment_id,
                mp_status=pago.mp_status,
                mp_status_detail=pago.mp_status_detail,
            )
            return ResultadoCrearPago(respuesta, aplicado.get("pedido_actualizado"))

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
            return ESTADO_PAGO_RECHAZADO
        if estado_mp in ("pending", "in_process", "authorized"):
            return ESTADO_PAGO_PENDIENTE
        return None

    @staticmethod
    def _resolver_pago_bloqueado(uow: PagoUnitOfWork, mp_payment_id: int, resultado: ResultadoMP) -> Pago | None:
        """Pago local (con la fila bloqueada): por `mp_payment_id`, luego `external_reference` (UUID del intento), luego `merchant_order_id`."""
        pago = uow.pagos.get_by_mp_payment_id_for_update(mp_payment_id)
        if pago is None and resultado.external_reference:
            try:
                referencia = UUID(str(resultado.external_reference))
            except ValueError:  # referencia heredada (id de pedido de Checkout Pro) u ajena: no es un intento local
                referencia = None
            if referencia is not None:
                pago = uow.pagos.get_by_external_reference_for_update(referencia)
        if pago is None and resultado.mp_merchant_order_id:
            pago = uow.pagos.get_by_mp_merchant_order_id_for_update(int(resultado.mp_merchant_order_id))
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
        access_token = self._get_mp_access_token()
        if not access_token:
            raise AppError(503, "HTTP_503", "MercadoPago no configurado: falta MP_ACCESS_TOKEN")

        try:
            resultado = self._pasarela(access_token).consultar_pago(mp_payment_id)
        except MercadoPagoNoDisponible as exc:  # fallo del proveedor: 502 (MercadoPago reintenta)
            raise AppError(502, "HTTP_502", "No se pudo consultar el pago en MercadoPago") from exc
        nuevo_estado = self._estado_local_para(resultado.mp_status)
        if nuevo_estado is None:
            return {"status": "ignored"}

        with PagoUnitOfWork(self._session) as uow:
            pago = self._resolver_pago_bloqueado(uow, mp_payment_id, resultado)
            if pago is None:
                return {"status": "ignored", "reason": "Pago not found"}
            return self._aplicar_resultado_mp(uow, pago, resultado, nuevo_estado, mp_payment_id)

    def _aplicar_resultado_mp(
        self,
        uow: PagoUnitOfWork,
        pago: Pago,
        resultado: ResultadoMP,
        nuevo_estado: str,
        mp_payment_id: int | None = None,
    ) -> dict:
        """Único camino que aplica el resultado de MercadoPago a un pago bloqueado (creación y webhook): idempotente."""
        mp_payment_id = mp_payment_id if mp_payment_id is not None else resultado.mp_payment_id
        if (
            decidir_transicion_pago(pago.estado, pago.mp_payment_id, mp_payment_id, nuevo_estado)
            == Accion.YA_PROCESADO
        ):
            return {"status": "already_processed"}

        pago.mp_payment_id = mp_payment_id
        pago.mp_status = resultado.mp_status
        pago.mp_status_detail = resultado.mp_status_detail
        pago.mp_merchant_order_id = resultado.mp_merchant_order_id
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

    def obtener_pago(self, pedido_id: int, usuario_id: int, roles: AbstractSet[str]) -> PagoEstadoResponse:
        with PagoUnitOfWork(self._session) as uow:
            self._obtener_pedido_autorizado(uow, pedido_id, usuario_id, roles)
            pago = uow.pagos.get_ultimo_by_pedido(pedido_id)
            if pago is None:
                return PagoEstadoResponse(pedido_id=pedido_id)
            return PagoEstadoResponse(
                pedido_id=pedido_id,
                pago_id=pago.id,
                estado=pago.estado,
                mp_status=pago.mp_status,
                mp_status_detail=pago.mp_status_detail,
            )
