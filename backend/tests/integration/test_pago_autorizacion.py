"""Autenticación y autorización de `POST /pagos/crear` y `GET /pagos/{pedido_id}` (C-04, DT-05).

El SDK de MercadoPago está mockeado en el borde (`app.modules.pagos.service.mercadopago.SDK`).
"""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.modules.pagos.models import Pago
from app.modules.usuarios.models import Usuario

CREAR = "/api/v1/pagos/crear"


def consultar(pedido_id: int) -> str:
    return f"/api/v1/pagos/{pedido_id}"


@pytest.fixture
def mp_sdk(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    sdk_class = MagicMock(name="mercadopago.SDK")
    sdk_class.return_value.preference.return_value.create.return_value = {
        "status": 201,
        "response": {"id": "pref-123", "init_point": "https://mp.example/init"},
    }
    monkeypatch.setattr("app.modules.pagos.service.mercadopago.SDK", sdk_class)
    return sdk_class


@pytest.fixture
def mp_configurado(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "mp-token-falso")
    monkeypatch.setattr(settings, "MP_PUBLIC_KEY", "mp-public-falsa")
    monkeypatch.setattr(settings, "MP_NOTIFICATION_URL", "https://a.example/api/v1/pagos/webhook")
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://b.example")


@pytest.fixture
def mp_sin_configurar(monkeypatch: pytest.MonkeyPatch) -> None:
    for nombre in ("MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_NOTIFICATION_URL", "BACKEND_PUBLIC_URL", "FRONTEND_URL"):
        monkeypatch.setattr(settings, nombre, None)


def pagos_de(session: Session, pedido_id: int) -> list[Pago]:
    session.expire_all()
    return list(session.exec(select(Pago).where(Pago.pedido_id == pedido_id)).all())


# ── Autenticación (401) ─────────────────────────────────────────────────────

def test_crear_pago_anonimo_responde_401_sin_crear_pago_ni_llamar_a_mp(
    client: TestClient, session: Session, pedido_db, mp_sdk: MagicMock, mp_configurado: None
) -> None:
    response = client.post(CREAR, json={"pedido_id": pedido_db.id})

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert pagos_de(session, pedido_db.id) == []
    mp_sdk.assert_not_called()


def test_consultar_pago_anonimo_responde_401_sin_estado(client: TestClient, pedido_db) -> None:
    response = client.get(consultar(pedido_db.id))

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert "estado" not in response.json()


def test_crear_pago_con_token_invalido_responde_401(client: TestClient, pedido_db) -> None:
    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers={"Authorization": "Bearer x.y.z"})

    assert response.status_code == 401


def test_consultar_pago_con_token_invalido_responde_401(client: TestClient, pedido_db) -> None:
    response = client.get(consultar(pedido_db.id), headers={"Authorization": "Bearer x.y.z"})

    assert response.status_code == 401


def test_crear_pago_anonimo_con_pedido_inexistente_responde_401_y_no_404(client: TestClient) -> None:
    response = client.post(CREAR, json={"pedido_id": 999999})

    assert response.status_code == 401


def test_consultar_pago_anonimo_con_pedido_inexistente_responde_401_y_no_404(client: TestClient) -> None:
    assert client.get(consultar(999999)).status_code == 401


# ── Rutas que siguen públicas ───────────────────────────────────────────────

def test_webhook_sin_token_con_topico_no_soportado_responde_200_ignored(client: TestClient) -> None:
    response = client.post("/api/v1/pagos/webhook", json={"type": "otro", "data": {"id": "1"}})

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_redirect_sin_token_con_frontend_url_redirige_y_no_responde_401(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://tienda.example")

    response = client.get("/api/v1/pagos/redirect/7/success", follow_redirects=False)

    assert response.status_code in (302, 307)
    assert response.headers["location"].startswith("https://tienda.example/payment/feedback/7")


# ── Autorización por propiedad (403 / 404) ──────────────────────────────────

def test_otro_cliente_consulta_pago_de_pedido_ajeno_responde_403_sin_estado(
    client: TestClient, pedido_db, usuario_con_roles
) -> None:
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.get(consultar(pedido_db.id), headers=headers_b)

    assert response.status_code == 403
    assert response.json()["code"] == "HTTP_403"
    assert "estado" not in response.json()


def test_otro_cliente_crea_pago_de_pedido_ajeno_responde_403_sin_crear_pago_ni_llamar_a_mp(
    client: TestClient, session: Session, pedido_db, usuario_con_roles, mp_sdk: MagicMock, mp_configurado: None
) -> None:
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=headers_b)

    assert response.status_code == 403
    assert response.json()["code"] == "HTTP_403"
    assert pagos_de(session, pedido_db.id) == []
    mp_sdk.assert_not_called()


# ── Propietario y ADMIN ─────────────────────────────────────────────────────

def test_propietario_consulta_su_pedido_sin_pagos_responde_200_con_estado_nulo(
    client: TestClient, pedido_db, user_auth_headers: dict
) -> None:
    response = client.get(consultar(pedido_db.id), headers=user_auth_headers)

    assert response.status_code == 200
    assert response.json() == {"estado": None, "pedido_id": pedido_db.id}


def test_propietario_consulta_su_pedido_con_pago_pendiente_responde_200_con_estado_pendiente(
    client: TestClient, session: Session, pedido_db, user_auth_headers: dict
) -> None:
    session.add(
        Pago(pedido_id=pedido_db.id, transaction_amount=1500, estado="pendiente", idempotency_key="k-propio-1")
    )
    session.commit()

    response = client.get(consultar(pedido_db.id), headers=user_auth_headers)

    assert response.status_code == 200
    assert response.json()["estado"] == "pendiente"
    assert response.json()["pedido_id"] == pedido_db.id


def test_propietario_crea_pago_con_mp_configurado_responde_201_y_queda_un_pago_pendiente(
    client: TestClient, session: Session, pedido_db, user_auth_headers: dict, mp_sdk: MagicMock, mp_configurado: None
) -> None:
    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 201
    assert body["preference_id"] == "pref-123"
    assert body["init_point"] == "https://mp.example/init"
    assert body["pago_id"] is not None
    pagos = pagos_de(session, pedido_db.id)
    assert [p.estado for p in pagos] == ["pendiente"]
    assert pagos[0].id == body["pago_id"]


def test_admin_consulta_pago_de_pedido_ajeno_responde_200(
    client: TestClient, session: Session, pedido_db, admin_auth_headers: dict
) -> None:
    session.add(
        Pago(pedido_id=pedido_db.id, transaction_amount=1500, estado="aprobado", idempotency_key="k-admin-1")
    )
    session.commit()

    response = client.get(consultar(pedido_db.id), headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json()["estado"] == "aprobado"


def test_admin_crea_pago_de_pedido_ajeno_responde_201_y_el_pago_queda_en_ese_pedido(
    client: TestClient, session: Session, pedido_db, admin_auth_headers: dict, mp_sdk: MagicMock, mp_configurado: None
) -> None:
    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=admin_auth_headers)

    assert response.status_code == 201
    assert len(pagos_de(session, pedido_db.id)) == 1


# ── Otros roles, inexistente y eliminado ────────────────────────────────────

@pytest.mark.parametrize("roles", [["PEDIDOS"], ["STOCK"], ["PEDIDOS", "STOCK"]])
def test_pedidos_y_stock_sin_ser_duenos_reciben_403_al_consultar_y_al_crear(
    client: TestClient, session: Session, pedido_db, usuario_con_roles, mp_sdk: MagicMock, mp_configurado: None,
    roles: list[str],
) -> None:
    _, headers = usuario_con_roles(roles)

    assert client.get(consultar(pedido_db.id), headers=headers).status_code == 403
    assert client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=headers).status_code == 403
    assert pagos_de(session, pedido_db.id) == []
    mp_sdk.assert_not_called()


def test_client_mas_admin_consulta_pedido_ajeno_responde_200(client: TestClient, pedido_db, usuario_con_roles) -> None:
    _, headers = usuario_con_roles(["CLIENT", "ADMIN"])

    assert client.get(consultar(pedido_db.id), headers=headers).status_code == 200


def test_admin_al_que_se_le_quita_el_rol_responde_403_con_el_mismo_token(
    client: TestClient, session: Session, pedido_db, usuario_con_roles
) -> None:
    usuario_id, headers = usuario_con_roles(["ADMIN"])
    assert client.get(consultar(pedido_db.id), headers=headers).status_code == 200

    usuario = session.get(Usuario, usuario_id)
    usuario.roles.clear()
    session.add(usuario)
    session.commit()

    assert client.get(consultar(pedido_db.id), headers=headers).status_code == 403


def test_admin_consulta_pedido_inexistente_responde_404_y_no_200_con_estado_nulo(
    client: TestClient, admin_auth_headers: dict
) -> None:
    response = client.get(consultar(999999), headers=admin_auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"


def test_cliente_crea_pago_de_pedido_inexistente_responde_404(
    client: TestClient, user_auth_headers: dict, mp_sdk: MagicMock, mp_configurado: None
) -> None:
    response = client.post(CREAR, json={"pedido_id": 999999}, headers=user_auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"
    mp_sdk.assert_not_called()


def test_pedido_eliminado_logicamente_responde_404_al_propietario(
    client: TestClient, session: Session, pedido_db, user_auth_headers: dict
) -> None:
    from datetime import datetime, timezone

    pedido_db.deleted_at = datetime.now(timezone.utc)
    session.add(pedido_db)
    session.commit()

    assert client.get(consultar(pedido_db.id), headers=user_auth_headers).status_code == 404
    assert client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=user_auth_headers).status_code == 404


# ── Orden de verificaciones (D5) ────────────────────────────────────────────

def test_otro_cliente_sin_mp_configurado_recibe_403_y_no_503(
    client: TestClient, pedido_db, usuario_con_roles, mp_sdk: MagicMock, mp_sin_configurar: None
) -> None:
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=headers_b)

    assert response.status_code == 403
    mp_sdk.assert_not_called()


def test_propietario_sin_mp_configurado_recibe_503_nombrando_el_access_token(
    client: TestClient, pedido_db, user_auth_headers: dict, mp_sdk: MagicMock, mp_sin_configurar: None
) -> None:
    response = client.post(CREAR, json={"pedido_id": pedido_db.id}, headers=user_auth_headers)

    assert response.status_code == 503
    assert "MP_ACCESS_TOKEN" in response.json()["detail"]
    mp_sdk.assert_not_called()
