"""Historial de estados append-only y ordenado (spec order-lifecycle)."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.historiales_estado_pedido.repository import (
    HistorialEstadoPedidoRepository,
    HistorialInmutableError,
)
from app.modules.pedidos.models import Pedido
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


def _pedido(session: Session, usuario_id: int, estado: str = "PENDIENTE", forma_pago: str = "EFECTIVO") -> Pedido:
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
    return pedido


def _fila(session: Session, pedido_id: int) -> HistorialEstadoPedido:
    fila = HistorialEstadoPedidoRepository(session).add(
        HistorialEstadoPedido(pedido_id=pedido_id, estado_desde=None, estado_hacia="PENDIENTE", motivo="Pedido creado")
    )
    session.commit()
    return fila


def test_update_del_repositorio_de_historial_falla_y_la_fila_no_cambia(session: Session, normal_user: dict) -> None:
    fila = _fila(session, _pedido(session, normal_user["id"]).id)
    fila.estado_hacia = "CANCELADO"
    fila.motivo = "alterado"

    with pytest.raises(HistorialInmutableError):
        HistorialEstadoPedidoRepository(session).update(fila)

    session.rollback()
    session.expire_all()
    releida = session.get(HistorialEstadoPedido, fila.id)
    assert (releida.estado_hacia, releida.motivo) == ("PENDIENTE", "Pedido creado")


def test_delete_del_repositorio_de_historial_falla_y_la_fila_sigue(session: Session, normal_user: dict) -> None:
    fila = _fila(session, _pedido(session, normal_user["id"]).id)

    with pytest.raises(HistorialInmutableError):
        HistorialEstadoPedidoRepository(session).delete(fila)

    session.expire_all()
    assert session.get(HistorialEstadoPedido, fila.id) is not None


def test_historial_con_igual_created_at_se_devuelve_por_id_ascendente(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"])
    instante = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    # Se inserta primero la de id mayor, para que el orden físico difiera del orden por id.
    session.add(HistorialEstadoPedido(id=9002, pedido_id=pedido.id, estado_desde="PENDIENTE", estado_hacia="CONFIRMADO", created_at=instante))
    session.flush()
    session.add(HistorialEstadoPedido(id=9001, pedido_id=pedido.id, estado_desde=None, estado_hacia="PENDIENTE", created_at=instante))
    session.commit()
    admin = crear_usuario_con_roles(session, ["ADMIN"])

    response = client.get(f"/api/v1/pedidos/{pedido.id}/historial", headers=bearer_de_usuario(admin, ["ADMIN"]))

    assert response.status_code == 200
    assert [fila["estado_hacia"] for fila in response.json()] == ["PENDIENTE", "CONFIRMADO"]


def test_recorrido_completo_de_un_pedido_deja_cinco_filas_encadenadas(client: TestClient, session: Session) -> None:
    from app.modules.productos.models import Producto

    cliente = crear_usuario_con_roles(session, ["CLIENT"])
    gestor = crear_usuario_con_roles(session, ["PEDIDOS"])
    producto = Producto(nombre="Pizza historial", precio_base="1000.00", stock_cantidad=10, disponible=True)
    session.add(producto)
    session.commit()
    h_cliente, h_gestor = bearer_de_usuario(cliente, ["CLIENT"]), bearer_de_usuario(gestor, ["PEDIDOS"])

    creado = client.post(
        "/api/v1/pedidos/",
        json={"forma_pago_codigo": "EFECTIVO", "items": [{"producto_id": producto.id, "cantidad": 1}]},
        headers=h_cliente,
    )
    assert creado.status_code == 201, creado.text
    pedido_id = creado.json()["id"]
    for destino in ("CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO"):
        r = client.patch(f"/api/v1/pedidos/{pedido_id}/estado", json={"estado_hacia": destino}, headers=h_gestor)
        assert r.status_code == 200, (destino, r.text)

    historial = client.get(f"/api/v1/pedidos/{pedido_id}/historial", headers=h_gestor).json()

    assert [(f["estado_desde"], f["estado_hacia"], f["usuario_id"]) for f in historial] == [
        (None, "PENDIENTE", cliente.id),
        ("PENDIENTE", "CONFIRMADO", gestor.id),
        ("CONFIRMADO", "EN_PREP", gestor.id),
        ("EN_PREP", "EN_CAMINO", gestor.id),
        ("EN_CAMINO", "ENTREGADO", gestor.id),
    ]
