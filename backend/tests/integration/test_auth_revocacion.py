"""Revocación inmediata (spec `auth-session`): un access deja de autenticar en cuanto se cierra su sesión."""
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.timestamps import utc_now
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from tests.support.auth_helpers import (
    access_sin_sesion,
    bearer,
    crear_usuario_con_roles,
    iniciar_sesion,
    renovar,
    sesion_del_access,
    todas_las_sesiones,
)

ME = "/api/v1/auth/me"


def _access(client: TestClient, usuario: dict) -> str:
    return iniciar_sesion(client, usuario).json()["access_token"]


def _invalido(client: TestClient):
    return client.get(ME, headers=bearer("no-es-un-jwt"))


# ── Logout y logout-all ─────────────────────────────────────────────────────

def test_el_access_deja_de_autenticar_justo_despues_del_logout(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    access = _access(client, normal_user_data)
    assert client.get(ME, headers=bearer(access)).status_code == 200
    client.post("/api/v1/auth/logout", headers=bearer(access))

    response = client.get(ME, headers=bearer(access))

    assert response.status_code == 401
    esperado = _invalido(client)
    assert response.json() == esperado.json()
    assert response.headers.get("www-authenticate") == esperado.headers.get("www-authenticate")


def test_logout_all_desde_un_navegador_invalida_el_access_de_las_otras_dos_sesiones(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    accesos = [_access(client, normal_user_data) for _ in range(3)]
    client.post("/api/v1/auth/logout-all", headers=bearer(accesos[0]))

    respuestas = [client.get(ME, headers=bearer(a)) for a in accesos[1:]]

    assert [r.status_code for r in respuestas] == [401, 401]
    esperado = _invalido(client)
    assert all(r.json() == esperado.json() for r in respuestas)
    assert all(r.headers.get("www-authenticate") == esperado.headers.get("www-authenticate") for r in respuestas)


def test_logout_de_una_sesion_no_invalida_el_access_de_la_otra(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    primera, segunda = _access(client, normal_user_data), _access(client, normal_user_data)
    client.post("/api/v1/auth/logout", headers=bearer(primera))

    assert client.get(ME, headers=bearer(segunda)).status_code == 200
    assert client.get(ME, headers=bearer(primera)).status_code == 401


# ── Sesión inexistente, ajena o vencida ─────────────────────────────────────

def test_access_con_sid_de_una_sesion_inexistente_devuelve_401(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])

    response = client.get(ME, headers=access_sin_sesion(usuario.id, ["CLIENT"]))

    assert response.status_code == 401
    assert response.json() == _invalido(client).json()


def test_access_con_el_sid_de_la_sesion_abierta_de_otro_usuario_devuelve_401(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    from app.core.security import create_access_token

    sesion_ajena = sesion_del_access(session, _access(client, normal_user_data))
    otro = crear_usuario_con_roles(session, ["CLIENT"])
    access = create_access_token(sub=str(otro.id), roles=["CLIENT"], sid=str(sesion_ajena.id))

    response = client.get(ME, headers=bearer(access))

    assert response.status_code == 401


def test_access_de_una_sesion_vencida_sin_cerrar_devuelve_401(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    access = _access(client, normal_user_data)
    sesion = sesion_del_access(session, access)
    sesion.expires_at = utc_now() - timedelta(minutes=1)
    session.add(sesion)
    session.commit()

    assert client.get(ME, headers=bearer(access)).status_code == 401


# ── Reuso y baja ────────────────────────────────────────────────────────────

def test_el_access_de_las_sesiones_cerradas_por_reuso_devuelve_401(
    client: TestClient, session: Session, monkeypatch, normal_user: dict, normal_user_data: dict
) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "REFRESH_REUSE_GRACE_SECONDS", 0)
    login = iniciar_sesion(client, normal_user_data)
    access_1, r1 = login.json()["access_token"], login.cookies.get("refresh_token")
    access_2 = _access(client, normal_user_data)
    assert renovar(client, r1).status_code == 200
    assert sesion_del_access(session, access_1).revoked_at is None

    assert renovar(client, r1).status_code == 401  # reuso: cierra las sesiones abiertas del usuario

    motivos = {s.revoked_reason for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]}
    assert motivos == {"REUSO"}
    assert client.get(ME, headers=bearer(access_1)).status_code == 401
    assert client.get(ME, headers=bearer(access_2)).status_code == 401


def test_el_access_de_un_usuario_dado_de_baja_devuelve_401_con_el_cuerpo_de_un_access_invalido(
    client: TestClient, admin_auth_headers: dict, normal_user: dict, normal_user_data: dict
) -> None:
    access = _access(client, normal_user_data)
    baja = client.delete(f"/api/v1/admin/usuarios/{normal_user['id']}", headers=admin_auth_headers)
    assert baja.status_code == 204

    response = client.get(ME, headers=bearer(access))

    assert response.status_code == 401
    assert response.json() == _invalido(client).json()


# ── Creación de pedidos ─────────────────────────────────────────────────────

def test_crear_un_pedido_con_el_access_de_una_sesion_cerrada_por_logout_all_devuelve_401_sin_efectos(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict, producto_db, direccion_db
) -> None:
    desde, otro_navegador = _access(client, normal_user_data), _access(client, normal_user_data)
    client.post("/api/v1/auth/logout-all", headers=bearer(desde))
    stock_antes = producto_db.stock_cantidad

    response = client.post(
        "/api/v1/pedidos/",
        json={
            "direccion_id": direccion_db.id,
            "forma_pago_codigo": "EFECTIVO",
            "items": [{"producto_id": producto_db.id, "cantidad": 1}],
        },
        headers=bearer(otro_navegador),
    )

    assert response.status_code == 401
    session.expire_all()
    assert session.exec(select(Pedido).where(Pedido.usuario_id == normal_user["id"])).all() == []
    assert session.get(Producto, producto_db.id).stock_cantidad == stock_antes
