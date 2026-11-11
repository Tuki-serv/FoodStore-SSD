"""Webhook de pagos: autenticación del origen (firma HMAC de MercadoPago), configuración y consulta al proveedor (C-05)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from tests.support.mp_firma import firmar
from tests.support.mp_webhook import SECRETO, TS, MPFalso, post_webhook
from tests.support.pagos_factory import estado_pedido, historial, pagos_de, pedido_con_pago, referencia_de


@pytest.fixture(name="pedido_mp")
def pedido_mp_fixture(session: Session, normal_user: dict, mp_sdk: MPFalso):
    """Pedido MERCADOPAGO PENDIENTE y un pago aprobado `123` de MercadoPago que apunta a él."""
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))
    return pedido


def _sin_cambios(session: Session, pedido_id: int) -> None:
    assert estado_pedido(session, pedido_id) == "PENDIENTE"
    assert historial(session, pedido_id) == []
    assert [(p.estado, p.mp_payment_id) for p in pagos_de(session, pedido_id)] == [("pendiente", None)]


# ─── Firma ────────────────────────────────────────────────────────────────────
def test_webhook_sin_firma_responde_401_y_no_consulta_ni_modifica(
    client: TestClient, session: Session, mp_sdk: MPFalso, pedido_mp
) -> None:
    response = post_webhook(client, "123", secreto=None)

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert mp_sdk.llamadas == []
    _sin_cambios(session, pedido_mp.id)


def test_webhook_con_firma_valida_se_acepta(client: TestClient, mp_sdk: MPFalso, pedido_mp) -> None:
    response = post_webhook(client, "123")

    assert response.status_code == 200
    assert response.json()["status"] == "processed"
    assert mp_sdk.llamadas == [123]


def test_webhook_firmado_con_otra_clave_responde_401(
    client: TestClient, session: Session, mp_sdk: MPFalso, pedido_mp
) -> None:
    response = post_webhook(client, "123", secreto="otra-clave")

    assert response.status_code == 401
    assert mp_sdk.llamadas == []
    _sin_cambios(session, pedido_mp.id)


def test_webhook_firmado_para_otro_id_que_el_de_la_query_responde_401(
    client: TestClient, session: Session, mp_sdk: MPFalso, pedido_mp
) -> None:
    response = post_webhook(client, "124", firmar_id="123")

    assert response.status_code == 401
    assert mp_sdk.llamadas == []
    _sin_cambios(session, pedido_mp.id)


def test_webhook_con_x_signature_basura_responde_401(client: TestClient, mp_sdk: MPFalso, pedido_mp) -> None:
    response = client.post(
        "/api/v1/pagos/webhook",
        params={"type": "payment", "data.id": "123"},
        json={"type": "payment", "data": {"id": "123"}},
        headers={"x-signature": "basura", "x-request-id": "req-1"},
    )

    assert response.status_code == 401
    assert mp_sdk.llamadas == []


def test_webhook_401_no_revela_el_motivo(client: TestClient, mp_sdk: MPFalso, pedido_mp) -> None:
    sin_firma = post_webhook(client, "123", secreto=None).json()
    mal_firmado = post_webhook(client, "123", secreto="otra-clave").json()

    for cuerpo in (sin_firma, mal_firmado):
        assert cuerpo["detail"] == "Firma de webhook inválida"
        assert "v1" not in cuerpo["detail"] and "ts" not in cuerpo["detail"].split()


def test_webhook_firmado_sin_request_id_se_acepta(client: TestClient, mp_sdk: MPFalso, pedido_mp) -> None:
    response = post_webhook(client, "123", request_id=None)

    assert response.status_code == 200
    assert mp_sdk.llamadas == [123]


def test_webhook_firmado_con_request_id_pero_header_ausente_responde_401(
    client: TestClient, mp_sdk: MPFalso, pedido_mp
) -> None:
    headers = firmar("123", "req-1", TS, SECRETO)
    del headers["x-request-id"]  # el manifest firmado incluía request-id, el header no llega

    response = client.post(
        "/api/v1/pagos/webhook",
        params={"type": "payment", "data.id": "123"},
        json={"type": "payment", "data": {"id": "123"}},
        headers=headers,
    )

    assert response.status_code == 401


# ─── Configuración e id de pago ───────────────────────────────────────────────
@pytest.mark.parametrize("con_firma", [True, False])
def test_webhook_sin_secreto_configurado_responde_503_nombrando_la_variable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, mp_sdk: MPFalso, pedido_mp, con_firma: bool
) -> None:
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", None)

    response = post_webhook(client, "123", secreto=SECRETO if con_firma else None)

    assert response.status_code == 503
    assert response.json()["code"] == "HTTP_503"
    assert "MP_WEBHOOK_SECRET" in response.json()["detail"]
    assert mp_sdk.llamadas == []


def test_webhook_de_pago_sin_access_token_responde_503_nombrando_la_variable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, pedido_mp
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", None)

    response = post_webhook(client, "123")

    assert response.status_code == 503
    assert "MP_ACCESS_TOKEN" in response.json()["detail"]


def test_webhook_de_otro_topico_sin_access_token_se_ignora(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, mp_sdk: MPFalso
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", None)

    response = post_webhook(client, "123", topic="merchant_order")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"


def test_webhook_con_id_de_query_y_de_cuerpo_distintos_responde_400_sin_consultar(
    client: TestClient, mp_sdk: MPFalso, pedido_mp
) -> None:
    response = post_webhook(client, "123", body={"type": "payment", "data": {"id": "999"}})

    assert response.status_code == 400
    assert mp_sdk.llamadas == []


def test_webhook_con_el_id_solo_en_la_query_consulta_ese_pago(client: TestClient, mp_sdk: MPFalso, pedido_mp) -> None:
    response = post_webhook(client, "123", body={"type": "payment"})

    assert response.status_code == 200
    assert mp_sdk.llamadas == [123]


# ─── Ruta pública con firma (MODIFIED de C-04) ────────────────────────────────
def test_webhook_firmado_de_topico_no_soportado_se_ignora_sin_authorization(client: TestClient, mp_sdk: MPFalso) -> None:
    response = post_webhook(client, "123", topic="merchant_order")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
    assert mp_sdk.llamadas == []


def test_webhook_sin_authorization_ni_firma_responde_401(client: TestClient, mp_sdk: MPFalso) -> None:
    response = post_webhook(client, "123", topic="merchant_order", secreto=None)

    assert response.status_code == 401


# ─── Consulta a MercadoPago ───────────────────────────────────────────────────
def test_webhook_con_error_del_proveedor_responde_502_sin_cambios(
    client: TestClient, session: Session, mp_sdk: MPFalso, pedido_mp
) -> None:
    mp_sdk.responder(123, referencia_de(session, pedido_mp.id), http_status=500)

    response = post_webhook(client, "123")

    assert response.status_code == 502
    assert response.json()["code"] == "HTTP_502"
    _sin_cambios(session, pedido_mp.id)


def test_webhook_con_estado_de_mercadopago_no_mapeado_se_ignora(
    client: TestClient, session: Session, mp_sdk: MPFalso, pedido_mp
) -> None:
    mp_sdk.responder(123, referencia_de(session, pedido_mp.id), estado="in_mediation")

    response = post_webhook(client, "123")

    assert response.status_code == 200
    assert response.json()["status"] == "ignored"
    _sin_cambios(session, pedido_mp.id)
