from collections.abc import Callable
from collections.abc import Set as AbstractSet
from decimal import Decimal
from fastapi import HTTPException
from sqlmodel import Session
from app.modules.detalles_pedido.models import DetallePedido
from app.core.websocket import ConnectionManager
from app.modules.detalles_pedido.schemas import DetallePedidoRead
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.historiales_estado_pedido.schemas import HistorialEstadoPedidoRead
from app.modules.pedidos.fsm import (
    ACTOR_SISTEMA,
    CANCELADO,
    CONFIRMADO,
    EN_PREP,
    Actor,
    destinos_permitidos,
    motivo_rechazo_confirmacion,
)
from app.modules.pedidos.models import Pedido
from app.modules.pedidos.schemas import (
    PedidoCambioEstado,
    PedidoCreate,
    PedidoReadFull,
    PedidoList,
    PedidoListAdmin,
    PedidoReadAdmin,
    PedidoRead
)
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from app.modules.productos.stock_service import LineaStock, ProductoNoDisponible, StockInsuficiente, StockService
import logging

logger = logging.getLogger("app.modules.pedidos.service")
logging.basicConfig(level=logging.INFO)

MOTIVO_SIN_STOCK = "Sin stock"
ORIGENES_CON_STOCK_DESCONTADO = frozenset({CONFIRMADO, EN_PREP})
"""Estados en los que el pedido ya descontó stock: cancelar desde ahí lo devuelve (spec `order-stock`)."""

PasoConfirmacion = Callable[[PedidoUnitOfWork, Pedido], None]
"""Paso que corre dentro de la transacción de toda transición a CONFIRMADO (descuento de stock, C-10)."""


def sin_efecto(uow: PedidoUnitOfWork, pedido: Pedido) -> None:
    """Paso de confirmación por defecto: no hace nada."""


def lineas_de_stock(uow: PedidoUnitOfWork, pedido: Pedido) -> list[LineaStock]:
    """Líneas de stock (producto, cantidad) de los detalles del pedido."""
    return [LineaStock(d.producto_id, d.cantidad) for d in uow.detalles.get_all_by_pedido_id(pedido.id)]


def descontar_stock_al_confirmar(uow: PedidoUnitOfWork, pedido: Pedido) -> None:
    """Paso de confirmación real (C-10): descuenta el stock del pedido en la transacción de la transición."""
    StockService(uow.productos).descontar(lineas_de_stock(uow, pedido))


class PedidoService:
    # ─── Normalización de estados ────────────────────────────────────────────────
    # Unifica variaciones de entrada (inglés, mayúsculas, parcial) a valores canónicos
    ESTADOS = {
        "pendiente": "PENDIENTE", "pending": "PENDIENTE",
        "confirmado": "CONFIRMADO", "confirmed": "CONFIRMADO",
        "en_prep": "EN_PREP", "en_preparacion": "EN_PREP", "preparando": "EN_PREP",
        "en_camino": "EN_CAMINO", "despachado": "EN_CAMINO", "shipped": "EN_CAMINO",
        "entregado": "ENTREGADO", "delivered": "ENTREGADO",
        "cancelado": "CANCELADO", "cancelled": "CANCELADO",
    }

    DESCUENTO_INICIAL = Decimal("0.00")
    COSTO_ENVIO_FIJO = Decimal("50.00")

    def __init__(self, uow: PedidoUnitOfWork, *, al_confirmar: PasoConfirmacion = sin_efecto):
        self._uow = uow
        self._al_confirmar = al_confirmar

    def crear_pedido(self, data: PedidoCreate, usuario_id: int) -> PedidoReadFull:
        with self._uow as uow:
            self._validar_forma_pago(uow, data.forma_pago_codigo)
            self._obtener_estado_o_error(
                uow=uow,
                codigo=self.ESTADOS['pendiente'],
                mensaje="Estado inicial no configurado",
                status_code=500,
            )
            items_unicos = set()
            for item in data.items:
                pers = tuple(sorted(item.personalizacion)) if item.personalizacion else tuple()
                identificador = (item.producto_id, pers)
                if identificador in items_unicos:
                    raise HTTPException(
                        status_code=400,
                        detail="No puede pedir dos veces el mismo producto con la misma personalización",
                    )
                items_unicos.add(identificador)
            subtotal = Decimal("0.00")
            detalles_creados = []
            for item in data.items:
                producto = uow.productos.get_by_id(item.producto_id)
                if producto is None:
                    raise HTTPException(
                        status_code=404, detail="Producto no encontrado")
                if getattr(producto, "deleted_at", None) is not None:
                    raise HTTPException(
                        status_code=404, detail="Producto no encontrado")
                precio_snapshot = producto.precio_base
                subtotal_snapshot = precio_snapshot * item.cantidad
                subtotal += subtotal_snapshot
                detalles_creados.append(
                    {
                        "item": item,
                        "producto": producto,
                        "subtotal_snapshot": subtotal_snapshot,
                    }
                )
            self._verificar_stock_al_crear(uow, data)
            descuento = self.DESCUENTO_INICIAL
            costo_envio = self.COSTO_ENVIO_FIJO
            total = subtotal - descuento + costo_envio
            pedido = Pedido(
                usuario_id=usuario_id,
                direccion_id=data.direccion_id,
                estado_codigo=self.ESTADOS['pendiente'],
                forma_pago_codigo=data.forma_pago_codigo,
                subtotal=subtotal,
                descuento=descuento,
                costo_envio=costo_envio,
                total=total,
                notas=data.notas,
            )
            pedido = uow.pedidos.add(pedido)
            for detalle_creado in detalles_creados:
                item = detalle_creado["item"]
                producto = detalle_creado["producto"]
                subtotal_snapshot = detalle_creado["subtotal_snapshot"]
                
                # Snapshot personalizacion
                nombres_removidos = None
                if item.personalizacion:
                    nombres_removidos = []
                    for ing_id in item.personalizacion:
                        ing = uow.ingredientes.get_by_id(ing_id)
                        if ing:
                            nombres_removidos.append(ing.nombre)
                
                detalle = DetallePedido(
                    pedido_id=pedido.id,
                    producto_id=item.producto_id,
                    cantidad=item.cantidad,
                    nombre_snapshot=producto.nombre,
                    precio_snapshot=producto.precio_base,
                    subtotal_snapshot=subtotal_snapshot,
                    personalizacion=item.personalizacion,
                    personalizacion_snapshot=nombres_removidos,
                )
                uow.detalles.add(detalle)
            self._registrar_historial(
                uow=uow,
                pedido_id=pedido.id,
                estado_desde=None,
                estado_hacia=self.ESTADOS['pendiente'],
                usuario_id=usuario_id,
                motivo="Pedido creado",
            )
            return self._armar_pedido_read_full(uow, pedido)

    @staticmethod
    def _verificar_stock_al_crear(uow: PedidoUnitOfWork, data: PedidoCreate) -> None:
        """Crear solo verifica disponibilidad y stock (sumando líneas del mismo producto); el descuento es al confirmar."""
        lineas = [LineaStock(item.producto_id, item.cantidad) for item in data.items]
        try:
            StockService(uow.productos).verificar(lineas)
        except ProductoNoDisponible:
            raise HTTPException(status_code=400, detail="Producto no disponible")
        except StockInsuficiente:
            raise HTTPException(status_code=400, detail="No hay stock suficiente")

    def obtener_pedido_por_id(self, pedido_id: int) -> PedidoReadFull:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            return self._armar_pedido_read_full(uow, pedido)

    def obtener_historial_pedido(self, pedido_id: int) -> list[HistorialEstadoPedidoRead]:
        with self._uow as uow:
            self._obtener_pedido_o_404(uow, pedido_id)
            historial = uow.historial.get_all_by_pedido_id(pedido_id)
            return [
                HistorialEstadoPedidoRead.model_validate(evento)
                for evento in historial
            ]
    
    #Queda como una función asincrona 
    async def cambiar_estado_pedido(
        self,
        pedido_id: int,
        data: PedidoCambioEstado,
        usuario_id: int,
        roles: AbstractSet[str],
        ws_manager: ConnectionManager | None = None,
    ) -> PedidoReadFull:
        try:
            with self._uow as uow:
                pedido = self._obtener_pedido_o_404(uow, pedido_id)
                estado_destino = self._obtener_estado_o_error(
                    uow=uow,
                    codigo=data.estado_hacia,
                    mensaje="Estado destino inválido",
                    status_code=400,
                )
                self._transicionar(
                    uow, pedido, estado_destino.codigo, Actor.usuario(usuario_id, roles), data.motivo
                )
                resultado = self._armar_pedido_read_full(uow, pedido)
        except StockInsuficiente as exc:  # el UoW ya hizo rollback: estado, historial y stock quedaron como estaban
            raise HTTPException(status_code=409, detail=str(exc)) from exc

        EVENTOS_WS = {
            "CONFIRMADO": "PEDIDO_CONFIRMADO",
            "EN_PREP": "PEDIDO_EN_PREPARACION",
            "CANCELADO": "PEDIDO_CANCELADO",
        }
        evento = EVENTOS_WS.get(resultado.estado_codigo, "ESTADO_ACTUALIZADO")

        if ws_manager:
            await ws_manager.send_to_room(
                "role:KDS",
                evento,
                resultado.model_dump(mode="json"),
            )
            await ws_manager.send_to_room(
                f"pedido:{pedido_id}",
                evento,
                resultado.model_dump(mode="json"),
            )
        return resultado

    def _obtener_pedido_o_404(self, uow, pedido_id: int) -> Pedido:
        pedido = uow.pedidos.get_by_id(pedido_id)
        if pedido is None or pedido.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
        return pedido

    def _validar_forma_pago(self, uow, codigo: str):
        forma_pago = uow.formas_pago.get_by_codigo(codigo)
        if forma_pago is None:
            raise HTTPException(
                status_code=400, detail="Forma de pago no encontrada")
        if not forma_pago.habilitado:
            raise HTTPException(
                status_code=400, detail="Forma de pago no está habilitada")
        return forma_pago

    def _obtener_estado_o_error(
        self,
        uow,
        codigo: str,
        mensaje: str,
        status_code: int = 400,
    ):
        estado = uow.estados.get_by_codigo(codigo)
        if estado is None:
            raise HTTPException(status_code=status_code, detail=mensaje)
        return estado

    def _transicionar(
        self,
        uow: PedidoUnitOfWork,
        pedido: Pedido,
        destino: str,
        actor: Actor,
        motivo: str | None,
    ) -> None:
        """Único lugar que aplica una transición: valida con la FSM, actualiza, confirma/restaura y deja el historial."""
        estado_actual = self._obtener_estado_o_error(
            uow=uow,
            codigo=pedido.estado_codigo,
            mensaje="El estado actual del pedido no está configurado",
            status_code=500,
        )
        origen = pedido.estado_codigo
        if estado_actual.es_terminal:
            raise HTTPException(
                status_code=409,
                detail="No se puede cambiar un pedido en estado terminal",
            )
        if destino not in destinos_permitidos(actor, origen, pedido.forma_pago_codigo):
            detalle = (
                motivo_rechazo_confirmacion(actor, pedido.forma_pago_codigo) if destino == CONFIRMADO else None
            )
            raise HTTPException(
                status_code=409,
                detail=detalle or f"No se puede cambiar de {origen} a {destino}",
            )
        if destino == self.ESTADOS["cancelado"] and not motivo:
            raise HTTPException(
                status_code=400,
                detail="El motivo es obligatorio para cancelar un pedido",
            )

        pedido.estado_codigo = destino
        uow.pedidos.update(pedido)
        if destino == CONFIRMADO:
            self._al_confirmar(uow, pedido)
        if destino == CANCELADO and origen in ORIGENES_CON_STOCK_DESCONTADO:
            StockService(uow.productos).devolver(lineas_de_stock(uow, pedido))
        self._registrar_historial(
            uow=uow,
            pedido_id=pedido.id,
            estado_desde=origen,
            estado_hacia=destino,
            usuario_id=actor.usuario_id,
            motivo=motivo,
        )
        quien = "Sistema" if actor.usuario_id is None else f"usuario {actor.usuario_id} roles {sorted(actor.roles)}"
        logger.info(
            f"AUDITORÍA FSM: {quien} cambió pedido {pedido.id} de '{origen}' a '{destino}'. Motivo: {motivo}"
        )

    def confirmar_por_pago_aprobado(self, pedido_id: int) -> PedidoReadFull:
        """Confirmación automática del webhook de pagos: actor Sistema, solo pedidos MERCADOPAGO en PENDIENTE."""
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            destino, motivo = CONFIRMADO, "Pago aprobado por MercadoPago"
            puede_confirmar = CONFIRMADO in destinos_permitidos(ACTOR_SISTEMA, pedido.estado_codigo, pedido.forma_pago_codigo)
            # Si el Sistema no puede confirmar, `_transicionar` levanta el 409 de siempre; si puede, se bloquea el stock y
            # se decide sin excepciones (así el commit del UoW no pierde el cambio del pago, IN-22).
            if puede_confirmar and StockService(uow.productos).alcanza(lineas_de_stock(uow, pedido)) is not None:
                destino, motivo = CANCELADO, MOTIVO_SIN_STOCK
            self._transicionar(uow, pedido, destino, ACTOR_SISTEMA, motivo)
            return self._armar_pedido_read_full(uow, pedido)

    def _registrar_historial(
        self,
        uow,
        pedido_id: int,
        estado_desde: str | None,
        estado_hacia: str,
        usuario_id: int | None,
        motivo: str | None = None,
    ) -> None:
        historial = HistorialEstadoPedido(
            pedido_id=pedido_id,
            estado_desde=estado_desde,
            estado_hacia=estado_hacia,
            usuario_id=usuario_id,
            motivo=motivo,
        )
        uow.historial.add(historial)

    def _armar_pedido_read_full(self, uow, pedido: Pedido) -> PedidoReadFull:

        detalles = uow.detalles.get_all_by_pedido_id(pedido.id)
        detalles_read = [
            DetallePedidoRead.model_validate(detalle)
            for detalle in detalles
        ]
        return PedidoReadFull(
            id=pedido.id,
            estado_codigo=pedido.estado_codigo,
            forma_pago_codigo=pedido.forma_pago_codigo,
            subtotal=pedido.subtotal,
            descuento=pedido.descuento,
            costo_envio=pedido.costo_envio,
            total=pedido.total,
            notas=pedido.notas,
            created_at=pedido.created_at,
            items=detalles_read,
        )

    def eliminar_pedido(self, pedido_id: int) -> None:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            if pedido.deleted_at is not None:
                raise HTTPException(
                    status_code=404, detail="Pedido no encontrado")
            uow.pedidos.delete(pedido)

    def obtener_pedidos_por_usuario(self, usuario_id: int, offset: int = 0, limit: int = 20) -> PedidoList:
        with self._uow as uow:
            pedidos = uow.pedidos.get_all_by_usuario_id(usuario_id, offset, limit)
            total = uow.pedidos.count_by_usuario_id(usuario_id)
            data = [PedidoRead.model_validate(p) for p in pedidos]
            return PedidoList(data=data, total=total)

    def _armar_pedido_read_admin(self, uow, pedido: Pedido) -> PedidoReadAdmin:
        full_pedido = self._armar_pedido_read_full(uow, pedido)
        usuario = uow.usuarios.get_by_id(pedido.usuario_id)
        cliente_nombre = usuario.nombre if usuario else f"Cliente #{pedido.usuario_id}"
        return PedidoReadAdmin(
            **full_pedido.model_dump(),
            cliente_nombre=cliente_nombre
        )

    def obtener_todos_los_pedidos(self, offset: int = 0, limit: int = 20) -> PedidoListAdmin:
        with self._uow as uow:
            pedidos = uow.pedidos.get_all_active(offset, limit)
            total = uow.pedidos.count_all_active()
            data = [self._armar_pedido_read_admin(uow, p) for p in pedidos]
            return PedidoListAdmin(data=data, total=total)

    def obtener_pedidos_cocina(self, offset: int = 0, limit: int = 20) -> PedidoListAdmin:
        with self._uow as uow:
            # Reutilizamos get_all_active que ya trae los no borrados
            pedidos = uow.pedidos.get_all_active(offset=0, limit=20)
            
            # Filtramos solo confirmado y preparando
            estados_cocina = {self.ESTADOS["confirmado"], self.ESTADOS["preparando"]}
            cocina_pedidos = [
                self._armar_pedido_read_admin(uow, p) 
                for p in pedidos 
                if p.estado_codigo in estados_cocina
            ]
            
            # Ordenamos por ID para que los más viejos salgan primero
            cocina_pedidos.sort(key=lambda p: p.id)
            
            return PedidoListAdmin(data=cocina_pedidos, total=len(cocina_pedidos))

    def obtener_pedido_propio(self, pedido_id: int, usuario_id: int) -> PedidoReadFull:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            if pedido.usuario_id != usuario_id:
                raise HTTPException(
                    status_code=403, detail="No tenés acceso a este pedido")
            return self._armar_pedido_read_full(uow, pedido)

    def cancelar_pedido_propio(self, pedido_id: int, usuario_id: int, roles: AbstractSet[str], data: PedidoCambioEstado) -> PedidoReadFull:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            if pedido.usuario_id != usuario_id:
                raise HTTPException(
                    status_code=403, detail="No tenés acceso a este pedido")
            self._transicionar(
                uow, pedido, self.ESTADOS["cancelado"], Actor.usuario(usuario_id, roles), data.motivo
            )
            return self._armar_pedido_read_full(uow, pedido)


def construir_pedido_service(session: Session) -> PedidoService:
    """Fábrica única del service: router y webhook comparten la misma configuración (paso de confirmación: descuento de stock)."""
    return PedidoService(PedidoUnitOfWork(session), al_confirmar=descontar_stock_al_confirmar)
