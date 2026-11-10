"""Autoridad de los roles: la BD en cada pedido; el claim `roles` del access es informativo y no autoriza."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.auth_helpers import bearer, bearer_con_roles, iniciar_sesion


def _crear_categoria(client: TestClient, admin_headers: dict) -> int:
    response = client.post(
        "/api/v1/categorias/", json={"nombre": "Autoridad Test", "descripcion": "x", "imagen_url": "http://img.com"}, headers=admin_headers
    )
    assert response.status_code == 201
    return response.json()["id"]


def _crear_usuario_por_admin(client: TestClient, admin_headers: dict, roles: list[str]) -> dict:
    datos = {
        "email": "autoridad@example.com",
        "password": "Autoridad123!",
        "nombre": "Auto",
        "apellido": "Ridad",
        "roles_codigos": roles,
    }
    response = client.post("/api/v1/admin/usuarios/createUser", json=datos, headers=admin_headers)
    assert response.status_code == 201
    return {**datos, "id": response.json()["id"]}


def test_claim_admin_de_un_client_en_la_bd_recibe_403_neutral_y_no_borra(
    client: TestClient, session: Session, admin_auth_headers: dict
) -> None:
    categoria_id = _crear_categoria(client, admin_auth_headers)
    headers = bearer_con_roles(session, ["CLIENT"], claims_roles=["ADMIN"])

    response = client.delete(f"/api/v1/categorias/{categoria_id}", headers=headers)

    assert response.status_code == 403
    cuerpo = response.json()
    assert cuerpo["detail"] == "Permisos insuficientes"
    assert cuerpo["code"] == "HTTP_403"
    assert "CLIENT" not in response.text and "ADMIN" not in response.text
    assert client.get(f"/api/v1/categorias/{categoria_id}").status_code == 200


def test_rol_quitado_en_la_bd_deja_sin_efecto_el_access_viejo(client: TestClient, admin_auth_headers: dict) -> None:
    usuario = _crear_usuario_por_admin(client, admin_auth_headers, ["ADMIN"])
    access = iniciar_sesion(client, usuario).json()["access_token"]
    assert client.get("/api/v1/admin/usuarios/", headers=bearer(access)).status_code == 200

    quitar = client.patch(
        f"/api/v1/admin/usuarios/{usuario['id']}", json={"roles_codigos": ["CLIENT"]}, headers=admin_auth_headers
    )
    assert quitar.status_code == 200

    assert client.get("/api/v1/admin/usuarios/", headers=bearer(access)).status_code == 403


def test_rol_agregado_en_la_bd_vale_con_el_access_viejo(client: TestClient, admin_auth_headers: dict) -> None:
    usuario = _crear_usuario_por_admin(client, admin_auth_headers, ["CLIENT"])
    access = iniciar_sesion(client, usuario).json()["access_token"]
    assert client.get("/api/v1/admin/usuarios/", headers=bearer(access)).status_code == 403

    agregar = client.patch(
        f"/api/v1/admin/usuarios/{usuario['id']}",
        json={"roles_codigos": ["CLIENT", "ADMIN"]},
        headers=admin_auth_headers,
    )
    assert agregar.status_code == 200

    assert client.get("/api/v1/admin/usuarios/", headers=bearer(access)).status_code == 200
