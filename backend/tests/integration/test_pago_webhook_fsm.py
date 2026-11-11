"""Webhook de pagos y FSM del pedido: la confirmación automática la hace el Sistema (usuario_id nulo)."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.detalles_pedido.models import DetallePedido
from app.modules.pagos.models import Pago
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


class _PagoAprobadoSDK:
    """Doble del borde externo (SDK de MercadoPago): `payment().get` devuelve un pago aprobado del pedido `ref`."""

    referencia: str = ""

    def __init__(self, access_token: str) -> None:
        pass

    def payment(self) -> "_PagoAprobadoSDK":
        return self

    def get(self, payment_id: int) -> dict:
        return {
            "status": 200,
            "response": {"id": payment_id, "status": "approved", "external_reference": type(self).referencia},
        }


@pytest.fixture(name="mp_aprobado")
def mp_aprobado_fixture(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "TEST-token")
    monkeypatch.setattr("app.modules.pagos.service.mercadopago.SDK", _PagoAprobadoSDK)

    def _apuntar_a(pedido_id: int) -> None:
        _PagoAprobadoSDK.referencia = str(pedido_id)

    return _apuntar_a


def _pedido_con_pago(session: Session, usuario_id: int, estado: str, forma_pago: str) -> Pedido:
    pedido = Pedido(
        usuario_id=usuario_id,
        estado_codigo=estado,
        forma_pago_codigo=forma_pago,
        subtotal="1500.00",
        total="1500.00",
        costo_envio="0.00",
        descuento="0.00",
    )
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    session.add(Pago(pedido_id=pedido.id, transaction_amount="1500.00", idempotency_key=str(uuid4())))
    session.commit()
    return pedido


def _historial(session: Session, pedido_id: int) -> list[HistorialEstadoPedido]:
    session.expire_all()
    return list(
        session.exec(
            select(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == pedido_id).order_by(HistorialEstadoPedido.id)
        ).all()
    )


def _webhook(client: TestClient, payment_id: str = "123"):
    return client.post("/api/v1/pagos/webhook", json={"type": "payment", "data": {"id": payment_id}})


def _estado(session: Session, pedido_id: int) -> str:
    session.expire_all()
    return session.get(Pedido, pedido_id).estado_codigo


def test_pago_aprobado_confirma_un_pedido_mercadopago_como_sistema(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "CONFIRMADO"
    ultima = _historial(session, pedido.id)[-1]
    assert (ultima.estado_desde, ultima.estado_hacia, ultima.usuario_id) == ("PENDIENTE", "CONFIRMADO", None)


def test_pago_aprobado_de_un_pedido_efectivo_no_lo_confirma(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "PENDIENTE"
    assert _historial(session, pedido.id) == []


def test_pago_aprobado_de_un_pedido_cancelado_lo_deja_cancelado(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "CANCELADO"
    assert _historial(session, pedido.id) == []


def test_confirmacion_manual_y_automatica_registran_una_fila_y_solo_difiere_el_actor(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    manual = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    automatico = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    pedidos = crear_usuario_con_roles(session, ["PEDIDOS"])
    mp_aprobado(automatico.id)

    resp_manual = client.patch(
        f"/api/v1/pedidos/{manual.id}/estado",
        json={"estado_hacia": "CONFIRMADO"},
        headers=bearer_de_usuario(pedidos, ["PEDIDOS"]),
    )
    resp_auto = _webhook(client)

    assert resp_manual.status_code == 200 and resp_auto.status_code == 200
    fila_manual, fila_auto = _historial(session, manual.id), _historial(session, automatico.id)
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in fila_manual] == [
        ("PENDIENTE", "CONFIRMADO", pedidos.id)
    ]
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in fila_auto] == [("PENDIENTE", "CONFIRMADO", None)]


# ─── Stock al confirmar por pago aprobado (spec order-stock, C-10) ───────────
def _producto(session: Session, nombre: str, stock: int) -> Producto:
    producto = Producto(nombre=nombre, precio_base="100.00", disponible=True, stock_cantidad=stock)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto


def _pedido_con_detalle(session: Session, usuario_id: int, producto: Producto, cantidad: int, forma_pago: str) -> Pedido:
    pedido = _pedido_con_pago(session, usuario_id, "PENDIENTE", forma_pago)
    session.add(
        DetallePedido(
            pedido_id=pedido.id,
            producto_id=producto.id,
            cantidad=cantidad,
            nombre_snapshot=producto.nombre,
            precio_snapshot="100.00",
            subtotal_snapshot=str(100 * cantidad),
        )
    )
    session.commit()
    return pedido


def _stock(session: Session, producto_id: int) -> int:
    session.expire_all()
    return session.get(Producto, producto_id).stock_cantidad


def test_pago_aprobado_confirma_un_pedido_mercadopago_y_descuenta_el_stock(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido = _pedido_con_detalle(session, normal_user["id"], a, 2, "MERCADOPAGO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "CONFIRMADO"
    assert _stock(session, a.id) == 3


def test_dos_pagos_aprobados_sobre_la_ultima_unidad_confirman_el_primero_y_cancelan_el_segundo_sin_stock(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    a = _producto(session, "Ultima unidad", 1)
    primero = _pedido_con_detalle(session, normal_user["id"], a, 1, "MERCADOPAGO")
    segundo = _pedido_con_detalle(session, normal_user["id"], a, 1, "MERCADOPAGO")

    mp_aprobado(primero.id)
    resp_1 = _webhook(client)
    mp_aprobado(segundo.id)
    resp_2 = _webhook(client, "124")  # otro pago de MercadoPago: `mp_payment_id` es único

    assert resp_1.status_code == 200 and resp_2.status_code == 200
    assert _estado(session, primero.id) == "CONFIRMADO"
    assert _estado(session, segundo.id) == "CANCELADO"
    fila = _historial(session, segundo.id)[-1]
    assert (fila.estado_desde, fila.estado_hacia, fila.motivo, fila.usuario_id) == (
        "PENDIENTE",
        "CANCELADO",
        "Sin stock",
        None,
    )
    assert session.exec(select(Pago).where(Pago.pedido_id == segundo.id)).one().estado == "a_devolver"
    assert session.exec(select(Pago).where(Pago.pedido_id == primero.id)).one().estado == "aprobado"
    assert _stock(session, a.id) == 0


def _dos_pedidos_sobre_la_ultima_unidad(
    client: TestClient, session: Session, usuario_id: int, mp_aprobado
) -> tuple[Producto, Pedido, Pedido]:
    a = _producto(session, "Ultima unidad", 1)
    primero = _pedido_con_detalle(session, usuario_id, a, 1, "MERCADOPAGO")
    segundo = _pedido_con_detalle(session, usuario_id, a, 1, "MERCADOPAGO")
    mp_aprobado(primero.id)
    _webhook(client)
    mp_aprobado(segundo.id)
    _webhook(client, "124")
    return a, primero, segundo


def test_consultar_el_pago_de_un_pedido_cancelado_sin_stock_informa_a_devolver(
    client: TestClient, session: Session, normal_user: dict, user_auth_headers: dict, mp_aprobado
) -> None:
    _, _, segundo = _dos_pedidos_sobre_la_ultima_unidad(client, session, normal_user["id"], mp_aprobado)

    response = client.get(f"/api/v1/pagos/{segundo.id}", headers=user_auth_headers)

    assert response.status_code == 200
    assert response.json()["estado"] == "a_devolver"


def test_reenviar_la_notificacion_del_pago_a_devolver_no_cambia_nada(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    a, _, segundo = _dos_pedidos_sobre_la_ultima_unidad(client, session, normal_user["id"], mp_aprobado)
    filas_antes = len(_historial(session, segundo.id))

    response = _webhook(client, "124")

    assert response.status_code == 200
    assert _estado(session, segundo.id) == "CANCELADO"
    assert len(_historial(session, segundo.id)) == filas_antes
    assert _stock(session, a.id) == 0


def test_pago_aprobado_de_un_pedido_efectivo_con_detalle_no_toca_el_stock(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido = _pedido_con_detalle(session, normal_user["id"], a, 2, "EFECTIVO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "PENDIENTE"
    assert _stock(session, a.id) == 5
