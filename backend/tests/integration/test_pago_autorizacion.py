"""Autenticación y autorización de `POST /pagos/crear` y `GET /pagos/{pedido_id}` (C-04, DT-05; contrato C-12).

El borde de MercadoPago está mockeado (`mp_sdk`: `MPFalso` parcheado en `app.modules.pagos.pasarela_mp`).
"""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.modules.pagos.models import Pago
from app.modules.usuarios.models import Usuario
from tests.support.mp_webhook import SECRETO, MPFalso, post_webhook
from tests.support.pagos_factory import pedido_a_pagar, producto

CREAR = "/api/v1/pagos/crear"


def consultar(pedido_id: int) -> str:
    return f"/api/v1/pagos/{pedido_id}"


def cuerpo(pedido_id: int) -> dict:
    """Lo que envía el brick `CardPayment` (el dato de la tarjeta es solo el token)."""
    return {
        "pedido_id": pedido_id,
        "token": "tok-1",
        "payment_method_id": "visa",
        "installments": 1,
        "payer": {"email": "a@test.com"},
    }


@pytest.fixture
def pedido_mp(session: Session, normal_user: dict):
    """Pedido `MERCADOPAGO` `PENDIENTE` del cliente `normal_user`, sin pagos."""
    return pedido_a_pagar(session, normal_user["id"], producto(session, "Autorizacion", 5))


@pytest.fixture
def mp_sin_configurar(monkeypatch: pytest.MonkeyPatch) -> None:
    for nombre in ("MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_NOTIFICATION_URL"):
        monkeypatch.setattr(settings, nombre, None)


def pagos_de(session: Session, pedido_id: int) -> list[Pago]:
    session.expire_all()
    return list(session.exec(select(Pago).where(Pago.pedido_id == pedido_id)).all())


# ── Autenticación (401) ─────────────────────────────────────────────────────

def test_crear_pago_anonimo_responde_401_sin_crear_pago_ni_llamar_a_mp(
    client: TestClient, session: Session, pedido_mp, mp_sdk: MPFalso
) -> None:
    response = client.post(CREAR, json=cuerpo(pedido_mp.id))

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert pagos_de(session, pedido_mp.id) == []
    assert mp_sdk.creaciones == []


def test_consultar_pago_anonimo_responde_401_sin_estado(client: TestClient, pedido_db) -> None:
    response = client.get(consultar(pedido_db.id))

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert "estado" not in response.json()


def test_crear_pago_con_token_invalido_responde_401(client: TestClient, pedido_mp) -> None:
    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers={"Authorization": "Bearer x.y.z"})

    assert response.status_code == 401


def test_consultar_pago_con_token_invalido_responde_401(client: TestClient, pedido_db) -> None:
    response = client.get(consultar(pedido_db.id), headers={"Authorization": "Bearer x.y.z"})

    assert response.status_code == 401


def test_crear_pago_anonimo_con_pedido_inexistente_responde_401_y_no_404(client: TestClient) -> None:
    response = client.post(CREAR, json=cuerpo(999999))

    assert response.status_code == 401


def test_consultar_pago_anonimo_con_pedido_inexistente_responde_401_y_no_404(client: TestClient) -> None:
    assert client.get(consultar(999999)).status_code == 401


# ── Rutas que siguen públicas ───────────────────────────────────────────────

def test_webhook_sin_token_con_firma_valida_y_topico_no_soportado_responde_200_ignored(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", SECRETO)  # el webhook se autentica por firma (C-05), no por JWT

    response = post_webhook(client, "1", topic="otro")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_la_ruta_de_redirect_de_checkout_pro_sin_token_responde_404_y_no_401(client: TestClient) -> None:
    response = client.get("/api/v1/pagos/redirect/7/success", follow_redirects=False)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"
    assert "location" not in response.headers


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
    client: TestClient, session: Session, pedido_mp, usuario_con_roles, mp_sdk: MPFalso
) -> None:
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers=headers_b)

    assert response.status_code == 403
    assert response.json()["code"] == "HTTP_403"
    assert pagos_de(session, pedido_mp.id) == []
    assert mp_sdk.creaciones == []


# ── Propietario y ADMIN ─────────────────────────────────────────────────────

def test_propietario_consulta_su_pedido_sin_pagos_responde_200_con_estado_nulo(
    client: TestClient, pedido_db, user_auth_headers: dict
) -> None:
    response = client.get(consultar(pedido_db.id), headers=user_auth_headers)

    assert response.status_code == 200
    assert response.json() == {
        "pedido_id": pedido_db.id,
        "pago_id": None,
        "estado": None,
        "mp_status": None,
        "mp_status_detail": None,
    }


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


def test_propietario_crea_pago_de_su_pedido_responde_201_aprobado_sin_campos_de_checkout_pro(
    client: TestClient, session: Session, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=777)

    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 201
    assert (body["estado"], body["mp_status"], body["mp_payment_id"]) == ("aprobado", "approved", 777)
    assert not {"preference_id", "init_point", "public_key"} & set(body)
    pagos = pagos_de(session, pedido_mp.id)
    assert [p.estado for p in pagos] == ["aprobado"]
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
    client: TestClient, session: Session, pedido_mp, admin_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=778)

    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers=admin_auth_headers)

    assert response.status_code == 201
    assert len(pagos_de(session, pedido_mp.id)) == 1


# ── Otros roles, inexistente y eliminado ────────────────────────────────────

@pytest.mark.parametrize("roles", [["PEDIDOS"], ["STOCK"], ["PEDIDOS", "STOCK"]])
def test_pedidos_y_stock_sin_ser_duenos_reciben_403_al_consultar_y_al_crear(
    client: TestClient, session: Session, pedido_mp, usuario_con_roles, mp_sdk: MPFalso, roles: list[str]
) -> None:
    _, headers = usuario_con_roles(roles)

    assert client.get(consultar(pedido_mp.id), headers=headers).status_code == 403
    assert client.post(CREAR, json=cuerpo(pedido_mp.id), headers=headers).status_code == 403
    assert pagos_de(session, pedido_mp.id) == []
    assert mp_sdk.creaciones == []


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
    client: TestClient, user_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    response = client.post(CREAR, json=cuerpo(999999), headers=user_auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"
    assert mp_sdk.creaciones == []


def test_pedido_eliminado_logicamente_responde_404_al_propietario(
    client: TestClient, session: Session, pedido_mp, user_auth_headers: dict
) -> None:
    pedido_mp.deleted_at = datetime.now(timezone.utc)
    session.add(pedido_mp)
    session.commit()

    assert client.get(consultar(pedido_mp.id), headers=user_auth_headers).status_code == 404
    assert client.post(CREAR, json=cuerpo(pedido_mp.id), headers=user_auth_headers).status_code == 404


# ── Orden de verificaciones ─────────────────────────────────────────────────

def test_otro_cliente_sin_mp_configurado_recibe_403_y_no_503(
    client: TestClient, pedido_mp, usuario_con_roles, mp_sdk: MPFalso, mp_sin_configurar: None
) -> None:
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers=headers_b)

    assert response.status_code == 403
    assert mp_sdk.creaciones == []


def test_propietario_sin_mp_configurado_recibe_503_nombrando_el_access_token(
    client: TestClient, session: Session, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso, mp_sin_configurar: None
) -> None:
    response = client.post(CREAR, json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    assert response.status_code == 503
    assert "MP_ACCESS_TOKEN" in response.json()["detail"]
    assert pagos_de(session, pedido_mp.id) == []
    assert mp_sdk.creaciones == []
