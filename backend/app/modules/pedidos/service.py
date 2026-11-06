from decimal import Decimal
from fastapi import HTTPException
from app.modules.detalles_pedido.models import DetallePedido
from app.core.websocket import ConnectionManager
from app.modules.detalles_pedido.schemas import DetallePedidoRead
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.historiales_estado_pedido.schemas import HistorialEstadoPedidoRead
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
import logging

logger = logging.getLogger("app.modules.pedidos.service")
logging.basicConfig(level=logging.INFO)

class PedidoService:
    # ─── Normalización de estados ────────────────────────────────────────────────
    # Unifica variaciones de entrada (inglés, mayúsculas, parcial) a valores canónicos
    ESTADOS = {
        "pendiente": "PENDIENTE", "pending": "PENDIENTE",
        "confirmado": "CONFIRMADO", "confirmed": "CONFIRMADO",
        "en_prep": "EN_PREP", "en_preparacion": "EN_PREP", "preparando": "EN_PREP",
        "entregado": "ENTREGADO", "delivered": "ENTREGADO",
        "cancelado": "CANCELADO", "cancelled": "CANCELADO",
    }

    # ─── FSM + Permisos por rol ──────────────────────────────────────────────────
    # Un solo lugar define qué transiciones puede hacer cada rol.
    # Si un rol no está en el dict, no tiene permisos para avanzar estados.
    TRANSICIONES = {
        "ADMIN": {
            "PENDIENTE":  {"CONFIRMADO", "CANCELADO"},
            "CONFIRMADO": {"EN_PREP", "CANCELADO"},
            "EN_PREP":    {"ENTREGADO", "CANCELADO"},
            "ENTREGADO":  set(),
            "CANCELADO":  set(),
        },
        "PEDIDOS": {
            "PENDIENTE":  {"CONFIRMADO", "CANCELADO"},
            "CONFIRMADO": {"EN_PREP", "CANCELADO"},
            "EN_PREP":    {"ENTREGADO", "CANCELADO"},
            "ENTREGADO":  set(),
            "CANCELADO":  set(),
        },
        "CLIENT": {
            "PENDIENTE":  {"CANCELADO"},
            "CONFIRMADO": {"CANCELADO"},
        },
    }
    
    DESCUENTO_INICIAL = Decimal("0.00")
    COSTO_ENVIO_FIJO = Decimal("50.00")

    def __init__(self, uow: PedidoUnitOfWork):
        self._uow = uow

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
                if not producto.disponible:
                    raise HTTPException(
                        status_code=400, detail="Producto no disponible")
                if producto.stock_cantidad < item.cantidad:
                    raise HTTPException(
                        status_code=400, detail="No hay stock suficiente")
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
            self.descontar_stock_del_pedido(uow, pedido.id)
            return self._armar_pedido_read_full(uow, pedido)

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
        rol: str,
        ws_manager: ConnectionManager | None = None,
    ) -> PedidoReadFull:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            estado_actual = self._obtener_estado_o_error(
                uow=uow,
                codigo=pedido.estado_codigo,
                mensaje="El estado actual del pedido no está configurado",
                status_code=500,
            )
            estado_destino = self._obtener_estado_o_error(
                uow=uow,
                codigo=data.estado_hacia,
                mensaje="Estado destino inválido",
                status_code=400,
            )
            self._validar_transicion(
                estado_actual_codigo=pedido.estado_codigo,
                estado_destino_codigo=estado_destino.codigo,
                estado_actual_es_terminal=estado_actual.es_terminal,
                motivo=data.motivo,
                rol=rol,
            )
            
            estado_origen = pedido.estado_codigo
            
            # Actualizamos el estado del pedido
            pedido.estado_codigo = estado_destino.codigo
            
            # Auditoría por consola (Log)
            logger.info(
                f"AUDITORÍA FSM: Usuario ID {usuario_id} (Rol: {rol}) "
                f"avanzó pedido {pedido_id} de '{estado_origen}' a '{estado_destino.codigo}'. "
                f"Motivo: {data.motivo}"
            )

            # Registramos el historial en BD
            uow.pedidos.update(pedido)
            
            if estado_destino.codigo == self.ESTADOS['cancelado']:
                self.restaurar_stock_del_pedido(uow, pedido.id)
                
            self._registrar_historial(
                uow=uow,
                pedido_id=pedido.id,
                estado_desde=estado_origen,
                estado_hacia=estado_destino.codigo,
                usuario_id=usuario_id,
                motivo=data.motivo,
            )

            resultado = self._armar_pedido_read_full(uow, pedido)

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

    def _validar_transicion(
        self,
        estado_actual_codigo: str,
        estado_destino_codigo: str,
        estado_actual_es_terminal: bool,
        motivo: str | None,
        rol: str,
    ) -> None:
        if estado_actual_es_terminal:
            raise HTTPException(
                status_code=409,
                detail="No se puede cambiar un pedido en estado terminal",
            )
        transiciones_permitidas = self.TRANSICIONES[rol].get(
            estado_actual_codigo,
            set(),
        )
        if estado_destino_codigo not in transiciones_permitidas:
            raise HTTPException(
                status_code=409,
                detail=f"No se puede cambiar de {estado_actual_codigo} a {estado_destino_codigo}",
            )
        if estado_destino_codigo == self.ESTADOS['cancelado'] and not motivo:
            raise HTTPException(
                status_code=400,
                detail="El motivo es obligatorio para cancelar un pedido",
            )

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

    def cancelar_pedido_propio(self, pedido_id: int, usuario_id: int, rol: str, data: PedidoCambioEstado) -> PedidoReadFull:
        with self._uow as uow:
            pedido = self._obtener_pedido_o_404(uow, pedido_id)
            if pedido.usuario_id != usuario_id:
                raise HTTPException(
                    status_code=403, detail="No tenés acceso a este pedido")
            estado_actual = self._obtener_estado_o_error(
                uow, pedido.estado_codigo, "Estado actual inválido", 500)
            self._validar_transicion(
                estado_actual_codigo=pedido.estado_codigo,
                estado_destino_codigo=self.ESTADOS['cancelado'],
                estado_actual_es_terminal=estado_actual.es_terminal,
                motivo=data.motivo,
                rol=rol,
            )
            estado_desde = pedido.estado_codigo
            pedido.estado_codigo = self.ESTADOS['cancelado']
            uow.pedidos.update(pedido)
            
            self.restaurar_stock_del_pedido(uow, pedido.id)
            
            self._registrar_historial(
                uow, pedido.id, estado_desde, self.ESTADOS['cancelado'], usuario_id, data.motivo)
            return self._armar_pedido_read_full(uow, pedido)

    def descontar_stock_del_pedido(self, uow, pedido_id: int) -> None:
        detalles = uow.detalles.get_all_by_pedido_id(pedido_id)
        for detalle in detalles:
            producto = uow.productos.get_for_update(detalle.producto_id)
            if producto is None or getattr(producto, "deleted_at", None) is not None:
                raise HTTPException(
                    status_code=404, detail="Producto no encontrado")
            if producto.stock_cantidad < detalle.cantidad:
                raise HTTPException(
                    status_code=409,
                    detail=f"No hay stock suficiente para {producto.nombre}",
                )
            producto.stock_cantidad -= detalle.cantidad
            uow.productos.update(producto)

    def restaurar_stock_del_pedido(self, uow, pedido_id: int) -> None:
        detalles = uow.detalles.get_all_by_pedido_id(pedido_id)
        for detalle in detalles:
            producto = uow.productos.get_for_update(detalle.producto_id)
            if producto is None or getattr(producto, "deleted_at", None) is not None:
                continue
            producto.stock_cantidad += detalle.cantidad
            uow.productos.update(producto)
