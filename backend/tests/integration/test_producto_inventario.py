"""Inventario manual: disponibilidad (fijar, idempotente) y stock absoluto (`PATCH /productos/{id}/stock`)."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.productos.models import Producto


def _producto_en_bd(session: Session, producto_id: int) -> Producto:
    session.expire_all()
    return session.get(Producto, producto_id)


def _fijar_disponibilidad(client: TestClient, headers: dict, producto_id: int, cuerpo: dict | None):
    return client.patch(f"/api/v1/productos/{producto_id}/disponibilidad", json=cuerpo, headers=headers)


def test_disponibilidad_stock_fija_false_y_repetir_no_la_invierte(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    primera = _fijar_disponibilidad(client, headers, producto_db.id, {"disponible": False})
    segunda = _fijar_disponibilidad(client, headers, producto_db.id, {"disponible": False})

    assert primera.status_code == 200
    assert primera.json()["disponible"] is False
    assert (primera.json()["nombre"], primera.json()["precio_base"], primera.json()["stock_cantidad"]) == (
        "Hamb. Test",
        "1500.00",
        100,
    )
    assert segunda.status_code == 200
    assert segunda.json()["disponible"] is False
    assert _producto_en_bd(session, producto_db.id).disponible is False


def test_stock_stock_setea_valor_absoluto_y_repetir_da_lo_mismo(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    producto_db.stock_cantidad = 10
    session.commit()
    _, headers = usuario_con_roles(["STOCK"])

    primera = client.patch(f"/api/v1/productos/{producto_db.id}/stock", json={"stock_cantidad": 7}, headers=headers)
    segunda = client.patch(f"/api/v1/productos/{producto_db.id}/stock", json={"stock_cantidad": 7}, headers=headers)

    assert primera.status_code == 200
    assert primera.json()["stock_cantidad"] == 7
    assert segunda.status_code == 200
    assert segunda.json()["stock_cantidad"] == 7
    assert _producto_en_bd(session, producto_db.id).stock_cantidad == 7


# ── Triangulación: disponibilidad ────────────────────────────────────────────

def _eliminar(session: Session, producto: Producto) -> None:
    from datetime import datetime, timezone

    producto.deleted_at = datetime.now(timezone.utc)
    session.commit()


def test_disponibilidad_admin_fija_true_sobre_un_producto_no_disponible(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    producto_db.disponible = False
    session.commit()

    response = _fijar_disponibilidad(client, admin_auth_headers, producto_db.id, {"disponible": True})

    assert response.status_code == 200
    assert response.json()["disponible"] is True
    assert _producto_en_bd(session, producto_db.id).disponible is True


def test_disponibilidad_sin_body_devuelve_422_y_no_cambia_el_valor(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    response = client.patch(f"/api/v1/productos/{producto_db.id}/disponibilidad", headers=admin_auth_headers)

    assert response.status_code == 422
    assert _producto_en_bd(session, producto_db.id).disponible is True


def test_disponibilidad_de_producto_eliminado_o_inexistente_devuelve_404(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    inexistente = _fijar_disponibilidad(client, admin_auth_headers, 999999, {"disponible": False})
    _eliminar(session, producto_db)
    eliminado = _fijar_disponibilidad(client, admin_auth_headers, producto_db.id, {"disponible": False})

    assert (inexistente.status_code, eliminado.status_code) == (404, 404)


def test_disponibilidad_false_no_modifica_el_stock(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    producto_db.stock_cantidad = 12
    session.commit()

    response = _fijar_disponibilidad(client, admin_auth_headers, producto_db.id, {"disponible": False})

    assert response.json()["stock_cantidad"] == 12
    assert _producto_en_bd(session, producto_db.id).stock_cantidad == 12


# ── Triangulación: stock ─────────────────────────────────────────────────────

def _fijar_stock(client: TestClient, headers: dict, producto_id: int, cuerpo: dict | None):
    return client.patch(f"/api/v1/productos/{producto_id}/stock", json=cuerpo, headers=headers)


def test_stock_negativo_devuelve_422_y_no_cambia(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    response = _fijar_stock(client, headers, producto_db.id, {"stock_cantidad": -1})

    assert response.status_code == 422
    assert _producto_en_bd(session, producto_db.id).stock_cantidad == 100


def test_stock_con_campos_extra_devuelve_422_y_no_cambia_ni_stock_ni_precio(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    response = _fijar_stock(client, headers, producto_db.id, {"stock_cantidad": 3, "precio_base": 1})

    assert response.status_code == 422
    en_bd = _producto_en_bd(session, producto_db.id)
    assert (en_bd.stock_cantidad, str(en_bd.precio_base)) == (100, "1500.00")


def test_stock_con_body_vacio_devuelve_422(client: TestClient, producto_db: Producto, usuario_con_roles) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    assert _fijar_stock(client, headers, producto_db.id, {}).status_code == 422


def test_stock_de_producto_eliminado_o_inexistente_devuelve_404(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    inexistente = _fijar_stock(client, admin_auth_headers, 999999, {"stock_cantidad": 5})
    _eliminar(session, producto_db)
    eliminado = _fijar_stock(client, admin_auth_headers, producto_db.id, {"stock_cantidad": 5})

    assert (inexistente.status_code, eliminado.status_code) == (404, 404)


def test_stock_cero_no_deshabilita_el_producto(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    _, headers = usuario_con_roles(["STOCK"])

    response = _fijar_stock(client, headers, producto_db.id, {"stock_cantidad": 0})

    assert response.status_code == 200
    assert (response.json()["stock_cantidad"], response.json()["disponible"]) == (0, True)


def test_stock_client_y_pedidos_reciben_403_sin_cambios_y_anonimo_401(
    client: TestClient, session: Session, producto_db: Producto, usuario_con_roles
) -> None:
    for roles in (["CLIENT"], ["PEDIDOS"]):
        _, headers = usuario_con_roles(roles)
        assert _fijar_stock(client, headers, producto_db.id, {"stock_cantidad": 1}).status_code == 403
    anonimo = _fijar_stock(client, {}, producto_db.id, {"stock_cantidad": 1})

    assert anonimo.status_code == 401
    assert _producto_en_bd(session, producto_db.id).stock_cantidad == 100


# ── Triangulación: camino real y autoridad ───────────────────────────────────

def _crear_usuario_por_admin(client: TestClient, admin_headers: dict, roles: list[str]) -> dict:
    datos = {
        "email": "inventario@example.com",
        "password": "Inventario123!",
        "nombre": "Inven",
        "apellido": "Tario",
        "roles_codigos": roles,
    }
    response = client.post("/api/v1/admin/usuarios/createUser", json=datos, headers=admin_headers)
    assert response.status_code == 201
    return {**datos, "id": response.json()["id"]}


def test_stock_creado_por_el_admin_hace_login_real_fija_stock_pero_no_edita_el_producto(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    from tests.support.auth_helpers import bearer, iniciar_sesion

    usuario = _crear_usuario_por_admin(client, admin_auth_headers, ["STOCK"])
    headers = bearer(iniciar_sesion(client, usuario).json()["access_token"])

    fijar = _fijar_stock(client, headers, producto_db.id, {"stock_cantidad": 55})
    editar = client.put(f"/api/v1/productos/{producto_db.id}", json={"nombre": "Otro"}, headers=headers)

    assert fijar.status_code == 200
    assert _producto_en_bd(session, producto_db.id).stock_cantidad == 55
    assert editar.status_code == 403
    assert _producto_en_bd(session, producto_db.id).nombre == "Hamb. Test"


def test_disponibilidad_rol_stock_agregado_vale_con_el_access_viejo(
    client: TestClient, session: Session, producto_db: Producto, admin_auth_headers: dict
) -> None:
    from tests.support.auth_helpers import bearer, iniciar_sesion

    usuario = _crear_usuario_por_admin(client, admin_auth_headers, ["CLIENT"])
    headers = bearer(iniciar_sesion(client, usuario).json()["access_token"])
    assert _fijar_disponibilidad(client, headers, producto_db.id, {"disponible": False}).status_code == 403

    client.patch(
        f"/api/v1/admin/usuarios/{usuario['id']}", json={"roles_codigos": ["CLIENT", "STOCK"]}, headers=admin_auth_headers
    )
    response = _fijar_disponibilidad(client, headers, producto_db.id, {"disponible": False})

    assert response.status_code == 200
    assert _producto_en_bd(session, producto_db.id).disponible is False
