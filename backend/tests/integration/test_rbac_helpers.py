"""Identidades de test con roles arbitrarios (`bearer_con_roles`, fixture `usuario_con_roles`)."""
from fastapi.testclient import TestClient
from datetime import timedelta
from uuid import UUID

from sqlmodel import Session

from app.core.security import decode_access_token
from app.core.timestamps import utc_now
from app.modules.refreshtokens.models import Sesion
from tests.support.auth_helpers import access_sin_sesion, bearer_con_roles, bearer_de_usuario, crear_usuario_con_roles


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


def test_bearer_de_usuario_emite_access_cuyo_sid_es_una_sesion_abierta_del_usuario(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])

    headers = bearer_de_usuario(session, usuario, ["CLIENT"])

    sid = decode_access_token(headers["Authorization"].removeprefix("Bearer "))["sid"]
    sesion = session.get(Sesion, UUID(sid))
    assert sesion is not None
    assert sesion.usuario_id == usuario.id
    assert sesion.revoked_at is None
    assert sesion.expires_at > utc_now() + timedelta(days=1)


def test_bearer_de_usuario_dos_llamadas_emiten_sesiones_distintas(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])

    sids = {
        decode_access_token(bearer_de_usuario(session, usuario, ["CLIENT"])["Authorization"].removeprefix("Bearer "))["sid"]
        for _ in range(2)
    }

    assert len(sids) == 2


def test_access_sin_sesion_emite_un_sid_que_no_corresponde_a_ninguna_sesion(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])

    headers = access_sin_sesion(usuario.id, ["CLIENT"])

    sid = decode_access_token(headers["Authorization"].removeprefix("Bearer "))["sid"]
    assert session.get(Sesion, UUID(sid)) is None
