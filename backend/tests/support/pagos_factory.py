"""Datos de pagos/pedidos/productos para tests de integración del webhook."""
from uuid import uuid4

from sqlmodel import Session, select

from app.modules.detalles_pedido.models import DetallePedido
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pagos.models import Pago
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto


def pedido_sin_pagos(session: Session, usuario_id: int, estado: str, forma_pago: str, total: str = "1500.00") -> Pedido:
    pedido = Pedido(
        usuario_id=usuario_id,
        estado_codigo=estado,
        forma_pago_codigo=forma_pago,
        subtotal=total,
        total=total,
        costo_envio="0.00",
        descuento="0.00",
    )
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido


def pedido_con_pago(session: Session, usuario_id: int, estado: str, forma_pago: str) -> Pedido:
    pedido = pedido_sin_pagos(session, usuario_id, estado, forma_pago)
    session.add(Pago(pedido_id=pedido.id, transaction_amount="1500.00", idempotency_key=str(uuid4())))
    session.commit()
    return pedido


def agregar_detalle(session: Session, pedido: Pedido, prod: Producto, cantidad: int) -> None:
    session.add(
        DetallePedido(
            pedido_id=pedido.id,
            producto_id=prod.id,
            cantidad=cantidad,
            nombre_snapshot=prod.nombre,
            precio_snapshot="100.00",
            subtotal_snapshot=str(100 * cantidad),
        )
    )
    session.commit()


def pedido_a_pagar(session: Session, usuario_id: int, prod: Producto, cantidad: int = 1, forma_pago: str = "MERCADOPAGO") -> Pedido:
    """Pedido `PENDIENTE` con un detalle y SIN pagos (lo que recibe `POST /pagos/crear`)."""
    pedido = pedido_sin_pagos(session, usuario_id, "PENDIENTE", forma_pago, total=str(100 * cantidad))
    agregar_detalle(session, pedido, prod, cantidad)
    return pedido


def producto(session: Session, nombre: str, stock: int) -> Producto:
    prod = Producto(nombre=nombre, precio_base="100.00", disponible=True, stock_cantidad=stock)
    session.add(prod)
    session.commit()
    session.refresh(prod)
    return prod


def pedido_con_detalle(session: Session, usuario_id: int, prod: Producto, cantidad: int, forma_pago: str) -> Pedido:
    pedido = pedido_con_pago(session, usuario_id, "PENDIENTE", forma_pago)
    agregar_detalle(session, pedido, prod, cantidad)
    return pedido


def historial(session: Session, pedido_id: int) -> list[HistorialEstadoPedido]:
    session.expire_all()
    return list(
        session.exec(
            select(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == pedido_id).order_by(HistorialEstadoPedido.id)
        ).all()
    )


def estado_pedido(session: Session, pedido_id: int) -> str:
    session.expire_all()
    return session.get(Pedido, pedido_id).estado_codigo


def stock_de(session: Session, producto_id: int) -> int:
    session.expire_all()
    return session.get(Producto, producto_id).stock_cantidad


def pagos_de(session: Session, pedido_id: int) -> list[Pago]:
    session.expire_all()
    return list(session.exec(select(Pago).where(Pago.pedido_id == pedido_id).order_by(Pago.id)).all())


def referencia_de(session: Session, pedido_id: int) -> str:
    """`external_reference` (UUID) del último intento de pago del pedido: la que MercadoPago devuelve en sus notificaciones."""
    return str(pagos_de(session, pedido_id)[-1].external_reference)
