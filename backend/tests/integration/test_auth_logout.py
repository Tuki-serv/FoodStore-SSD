"""Cierre de sesión: `POST /auth/logout` (sesión del access) y `POST /auth/logout-all` (todas las del usuario)."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.auth_helpers import (
    bearer,
    cookie_de_refresh_borrada,
    iniciar_sesion,
    refresh_tokens_de,
    renovar,
    sesion_del_access,
    todas_las_sesiones,
)


# ── Logout ──────────────────────────────────────────────────────────────────

def test_logout_cierra_solo_la_sesion_del_access_borra_la_cookie_y_el_refresh_ya_no_renueva(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    primera = iniciar_sesion(client, normal_user_data)
    segunda = iniciar_sesion(client, normal_user_data)
    sesion_1 = sesion_del_access(session, primera.json()["access_token"])
    sesion_2 = sesion_del_access(session, segunda.json()["access_token"])

    response = client.post("/api/v1/auth/logout", headers=bearer(primera.json()["access_token"]))

    assert response.status_code == 204
    assert cookie_de_refresh_borrada(response)
    motivos = {s.id: s.revoked_reason for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]}
    assert motivos == {sesion_1.id: "LOGOUT", sesion_2.id: None}
    # El refresh de la sesión cerrada ya no renueva, y no se lo toma por reuso.
    intento = renovar(client, primera.cookies.get("refresh_token"))
    assert intento.status_code == 401
    assert {s.revoked_reason for s in todas_las_sesiones(session) if s.id == sesion_2.id} == {None}


def test_logout_sin_bearer_devuelve_401(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 401


def test_logout_repetido_responde_204_y_conserva_motivo_e_instante_del_primer_cierre(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    access = iniciar_sesion(client, normal_user_data).json()["access_token"]
    sesion = sesion_del_access(session, access)

    primero = client.post("/api/v1/auth/logout", headers=bearer(access))
    instante = sesion_del_access(session, access).revoked_at
    segundo = client.post("/api/v1/auth/logout", headers=bearer(access))

    assert (primero.status_code, segundo.status_code) == (204, 204)
    despues = sesion_del_access(session, access)
    assert despues.id == sesion.id
    assert despues.revoked_reason == "LOGOUT"
    assert despues.revoked_at == instante


def test_el_access_sigue_autenticando_despues_del_logout_hasta_su_vencimiento(
    client: TestClient, normal_user: dict, normal_user_data: dict
) -> None:
    access = iniciar_sesion(client, normal_user_data).json()["access_token"]
    client.post("/api/v1/auth/logout", headers=bearer(access))

    response = client.get("/api/v1/auth/me", headers=bearer(access))

    assert response.status_code == 200
    assert response.json()["email"] == normal_user_data["email"]


def test_logout_con_el_access_de_otro_usuario_no_cierra_sesiones_ajenas(
    client: TestClient, session: Session, admin_auth_headers: dict, normal_user: dict, normal_user_data: dict
) -> None:
    iniciar_sesion(client, normal_user_data)

    response = client.post("/api/v1/auth/logout", headers=admin_auth_headers)

    assert response.status_code == 204
    assert [s.revoked_at for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]] == [None]


# ── Logout-all ──────────────────────────────────────────────────────────────

def test_logout_all_cierra_las_tres_sesiones_propias_y_no_toca_las_de_otro_usuario(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    accesos = [iniciar_sesion(client, normal_user_data).json()["access_token"] for _ in range(3)]
    admin = client.post("/api/v1/auth/login", data={"username": "admin@foodstore.com", "password": "admin123"})
    sesion_admin = sesion_del_access(session, admin.json()["access_token"])

    response = client.post("/api/v1/auth/logout-all", headers=bearer(accesos[0]))

    assert response.status_code == 204
    assert cookie_de_refresh_borrada(response)
    propias = [s for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]]
    assert len(propias) == 3
    assert {s.revoked_reason for s in propias} == {"LOGOUT_ALL"}
    assert [s.revoked_at for s in todas_las_sesiones(session) if s.id == sesion_admin.id] == [None]


def test_logout_all_sin_bearer_devuelve_401(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout-all").status_code == 401


def test_logout_all_conserva_el_motivo_de_las_sesiones_ya_cerradas(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    cerrada = iniciar_sesion(client, normal_user_data).json()["access_token"]
    abierta = iniciar_sesion(client, normal_user_data).json()["access_token"]
    client.post("/api/v1/auth/logout", headers=bearer(cerrada))

    client.post("/api/v1/auth/logout-all", headers=bearer(abierta))

    motivos = {s.id: s.revoked_reason for s in todas_las_sesiones(session) if s.usuario_id == normal_user["id"]}
    assert motivos[sesion_del_access(session, cerrada).id] == "LOGOUT"
    assert motivos[sesion_del_access(session, abierta).id] == "LOGOUT_ALL"


# ── Historial ───────────────────────────────────────────────────────────────

def test_el_ciclo_login_dos_renovaciones_logout_conserva_la_sesion_y_sus_tres_refresh(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    login = iniciar_sesion(client, normal_user_data)
    sesion = sesion_del_access(session, login.json()["access_token"])
    valor = login.cookies.get("refresh_token")
    for _ in range(2):
        respuesta = renovar(client, valor)
        valor = respuesta.cookies.get("refresh_token")
    acceso = respuesta.json()["access_token"]

    assert client.post("/api/v1/auth/logout", headers=bearer(acceso)).status_code == 204

    assert sesion_del_access(session, acceso).revoked_reason == "LOGOUT"
    tokens = refresh_tokens_de(session, sesion)
    assert [t.revoked_at is not None for t in tokens] == [True, True, False]
