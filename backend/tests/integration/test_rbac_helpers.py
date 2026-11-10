"""Identidades de test con roles arbitrarios (`bearer_con_roles`, fixture `usuario_con_roles`)."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import decode_access_token
from tests.support.auth_helpers import bearer_con_roles


def _roles_de_me(client: TestClient, headers: dict[str, str]) -> set[str]:
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    return {rol["codigo"] for rol in response.json()["roles"]}


def test_bearer_con_roles_client_y_stock_autentica_con_ambos_roles(client: TestClient, session: Session) -> None:
    headers = bearer_con_roles(session, ["CLIENT", "STOCK"])

    assert _roles_de_me(client, headers) == {"CLIENT", "STOCK"}


def test_bearer_con_roles_claims_desfasados_no_cambian_los_roles_de_la_bd(client: TestClient, session: Session) -> None:
    headers = bearer_con_roles(session, ["CLIENT"], claims_roles=["ADMIN"])

    claim = decode_access_token(headers["Authorization"].removeprefix("Bearer "))["roles"]
    assert claim == ["ADMIN"]
    assert _roles_de_me(client, headers) == {"CLIENT"}


def test_bearer_con_roles_tres_roles_aparecen_los_tres(client: TestClient, session: Session) -> None:
    headers = bearer_con_roles(session, ["STOCK", "PEDIDOS", "CLIENT"])

    assert _roles_de_me(client, headers) == {"STOCK", "PEDIDOS", "CLIENT"}


def test_bearer_con_roles_cocina_sembrado_por_la_fixture_funciona(client: TestClient, session: Session) -> None:
    headers = bearer_con_roles(session, ["COCINA"])

    assert _roles_de_me(client, headers) == {"COCINA"}


def test_usuario_con_roles_devuelve_id_y_headers(client: TestClient, usuario_con_roles) -> None:
    usuario_id, headers = usuario_con_roles(["PEDIDOS"])

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.json()["id"] == usuario_id
