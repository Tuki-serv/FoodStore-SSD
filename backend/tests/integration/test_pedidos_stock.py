"""Stock de los pedidos por HTTP (spec order-stock): crear verifica, confirmar descuenta, cancelar devuelve."""
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


def _producto(session: Session, nombre: str, stock: int, disponible: bool = True) -> Producto:
    producto = Producto(nombre=nombre, precio_base="100.00", disponible=disponible, stock_cantidad=stock)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto


def _stock(session: Session, producto_id: int) -> int:
    session.expire_all()
    return session.get(Producto, producto_id).stock_cantidad


def _crear_pedido(client: TestClient, headers: dict, direccion_id: int, items: list[tuple[int, int]], forma: str = "EFECTIVO"):
    return client.post(
        "/api/v1/pedidos/",
        json={
            "direccion_id": direccion_id,
            "forma_pago_codigo": forma,
            "items": [{"producto_id": pid, "cantidad": cant} for pid, cant in items],
        },
        headers=headers,
    )


def _cambiar(client: TestClient, headers: dict, pedido_id: int, destino: str, motivo: str | None = None):
    return client.patch(
        f"/api/v1/pedidos/{pedido_id}/estado", json={"estado_hacia": destino, "motivo": motivo}, headers=headers
    )


def _headers(session: Session, *roles: str) -> dict[str, str]:
    return bearer_de_usuario(crear_usuario_con_roles(session, list(roles)), list(roles))


# ─── Crear no descuenta ──────────────────────────────────────────────────────
def test_crear_un_pedido_no_descuenta_el_stock(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)

    response = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)])

    assert response.status_code == 201
    assert response.json()["estado_codigo"] == "PENDIENTE"
    assert _stock(session, a.id) == 5


def test_crear_con_dos_lineas_del_mismo_producto_que_suman_mas_que_el_stock_responde_400_y_no_crea_pedido(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    pedidos_antes = len(session.exec(select(Pedido)).all())
    payload = {
        "direccion_id": direccion_db.id,
        "forma_pago_codigo": "EFECTIVO",
        "items": [
            {"producto_id": a.id, "cantidad": 3},
            {"producto_id": a.id, "cantidad": 3, "personalizacion": [987654]},
        ],
    }

    response = client.post("/api/v1/pedidos/", json=payload, headers=user_auth_headers)

    assert response.status_code == 400
    assert "stock" in response.json()["detail"]
    assert len(session.exec(select(Pedido)).all()) == pedidos_antes
    assert _stock(session, a.id) == 5


def test_crear_con_un_producto_no_disponible_responde_400_y_no_crea_pedido(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5, disponible=False)
    pedidos_antes = len(session.exec(select(Pedido)).all())

    response = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 1)])

    assert response.status_code == 400
    assert "no disponible" in response.json()["detail"]
    assert len(session.exec(select(Pedido)).all()) == pedidos_antes


def test_crear_con_mas_cantidad_que_el_stock_responde_400(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)

    response = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 6)])

    assert response.status_code == 400
    assert "stock" in response.json()["detail"]


# ─── Confirmación manual descuenta o se rechaza ──────────────────────────────
def test_confirmar_a_mano_un_pedido_efectivo_descuenta_el_stock(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)]).json()["id"]

    response = _cambiar(client, _headers(session, "PEDIDOS"), pedido_id, "CONFIRMADO")

    assert response.status_code == 200
    assert response.json()["estado_codigo"] == "CONFIRMADO"
    assert _stock(session, a.id) == 3


def _historial_hacia(session: Session, pedido_id: int, destino: str) -> list[HistorialEstadoPedido]:
    session.expire_all()
    return list(
        session.exec(
            select(HistorialEstadoPedido).where(
                HistorialEstadoPedido.pedido_id == pedido_id, HistorialEstadoPedido.estado_hacia == destino
            )
        ).all()
    )


def test_confirmar_sin_stock_suficiente_responde_409_y_el_pedido_sigue_pendiente(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Hamburguesa Doble", 5)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)], forma="TRANSFERENCIA").json()["id"]
    a.stock_cantidad = 1
    session.add(a)
    session.commit()

    response = _cambiar(client, _headers(session, "ADMIN"), pedido_id, "CONFIRMADO")

    assert response.status_code == 409
    assert "Hamburguesa Doble" in response.json()["detail"]
    session.expire_all()
    assert session.get(Pedido, pedido_id).estado_codigo == "PENDIENTE"
    assert _historial_hacia(session, pedido_id, "CONFIRMADO") == []
    assert _stock(session, a.id) == 1


def test_confirmar_un_pedido_con_varios_productos_descuenta_cada_uno(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 4)
    b = _producto(session, "Stock B", 3)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 1), (b.id, 3)]).json()["id"]

    response = _cambiar(client, _headers(session, "PEDIDOS"), pedido_id, "CONFIRMADO")

    assert response.status_code == 200
    assert (_stock(session, a.id), _stock(session, b.id)) == (3, 0)


def test_confirmar_cuando_una_linea_alcanza_y_otra_no_responde_409_y_ningun_stock_cambia(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    b = _producto(session, "Stock B", 3)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 1), (b.id, 2)]).json()["id"]
    b.stock_cantidad = 1
    session.add(b)
    session.commit()

    response = _cambiar(client, _headers(session, "PEDIDOS"), pedido_id, "CONFIRMADO")

    assert response.status_code == 409
    assert "Stock B" in response.json()["detail"]
    assert (_stock(session, a.id), _stock(session, b.id)) == (5, 1)
    session.expire_all()
    assert session.get(Pedido, pedido_id).estado_codigo == "PENDIENTE"


# ─── Cancelar devuelve solo desde CONFIRMADO+ ────────────────────────────────
def _cancelar_propio(client: TestClient, headers: dict, pedido_id: int):
    return client.patch(
        f"/api/v1/pedidos/mis-pedidos/{pedido_id}/cancelar",
        json={"estado_hacia": "CANCELADO", "motivo": "me arrepentí"},
        headers=headers,
    )


def test_cancelar_un_pedido_pendiente_no_modifica_el_stock(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)]).json()["id"]

    response = _cancelar_propio(client, user_auth_headers, pedido_id)

    assert response.status_code == 200
    assert response.json()["estado_codigo"] == "CANCELADO"
    assert _stock(session, a.id) == 5


def test_confirmar_y_cancelar_el_pedido_propio_devuelve_el_stock_original(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)]).json()["id"]
    _cambiar(client, _headers(session, "PEDIDOS"), pedido_id, "CONFIRMADO")
    assert _stock(session, a.id) == 3

    response = _cancelar_propio(client, user_auth_headers, pedido_id)

    assert response.status_code == 200
    assert _stock(session, a.id) == 5


def test_pedidos_cancela_un_pedido_en_preparacion_y_devuelve_el_stock(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 1)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 1)]).json()["id"]
    headers = _headers(session, "PEDIDOS")
    _cambiar(client, headers, pedido_id, "CONFIRMADO")
    _cambiar(client, headers, pedido_id, "EN_PREP")
    assert _stock(session, a.id) == 0

    response = _cambiar(client, headers, pedido_id, "CANCELADO", motivo="cliente no atiende")

    assert response.status_code == 200
    assert _stock(session, a.id) == 1


def test_cancelar_un_confirmado_cuyo_producto_fue_eliminado_no_falla_ni_cambia_su_stock(
    client: TestClient, session: Session, user_auth_headers: dict, direccion_db
) -> None:
    a = _producto(session, "Stock A", 5)
    pedido_id = _crear_pedido(client, user_auth_headers, direccion_db.id, [(a.id, 2)]).json()["id"]
    _cambiar(client, _headers(session, "PEDIDOS"), pedido_id, "CONFIRMADO")
    session.expire_all()
    producto = session.get(Producto, a.id)
    producto.deleted_at = producto.created_at
    session.add(producto)
    session.commit()

    response = _cancelar_propio(client, user_auth_headers, pedido_id)

    assert response.status_code == 200
    assert _stock(session, a.id) == 3
