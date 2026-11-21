"""Los logs de `POST /pagos/crear` y del webhook no contienen secretos (access token, clave del webhook, token de tarjeta, `v1`)."""
import logging

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.mp_firma import firmar
from tests.support.mp_webhook import SECRETO, TS, MPFalso, post_webhook
from tests.support.pagos_factory import (
    pedido_a_pagar,
    pedido_con_detalle,
    producto,
    referencia_de,
)

CREAR = "/api/v1/pagos/crear"
ACCESS_TOKEN = "TEST-token"  # el que fija el fixture `mp_sdk`: literal de test, nunca el del `.env`
TOKEN_TARJETA = "tok-secreto-de-tarjeta"


def _cuerpo_crear(pedido_id: int) -> dict:
    return {
        "pedido_id": pedido_id,
        "token": TOKEN_TARJETA,
        "payment_method_id": "visa",
        "payment_type_id": "credit_card",
        "installments": 1,
        "payer": {"email": "a@test.com"},
    }


def _v1_de(headers: dict[str, str]) -> str:
    return headers["x-signature"].split("v1=")[1]


def _sin_secretos(caplog: pytest.LogCaptureFixture, *extras: str) -> None:
    assert caplog.records, "el escenario no registró ningún log: la aserción no probaría nada"
    for secreto in (ACCESS_TOKEN, SECRETO, TOKEN_TARJETA, *extras):
        assert secreto not in caplog.text


@pytest.fixture(name="pedido_a_cobrar")
def pedido_a_cobrar_fixture(session: Session, normal_user: dict):
    return pedido_a_pagar(session, normal_user["id"], producto(session, "Logs", 50), 15)  # total 1500.00


@pytest.mark.parametrize(
    "configurar",
    [
        lambda mp: mp.fallar_creacion(OSError("fallo de red")),
        lambda mp: mp.responder_orden_error(401, "unauthorized"),
        lambda mp: mp.responder_orden_error(500, "internal_error"),
    ],
    ids=["red", "401", "500"],
)
def test_los_errores_al_crear_el_pago_no_filtran_secretos(
    client: TestClient,
    user_auth_headers: dict,
    mp_sdk: MPFalso,
    pedido_a_cobrar,
    caplog: pytest.LogCaptureFixture,
    configurar,
) -> None:
    caplog.set_level(logging.DEBUG)
    configurar(mp_sdk)

    response = client.post(CREAR, json=_cuerpo_crear(pedido_a_cobrar.id), headers=user_auth_headers)

    assert response.status_code in (502, 503)
    _sin_secretos(caplog)


def test_la_firma_con_otra_clave_se_registra_sin_la_clave_ni_el_v1(
    client: TestClient, mp_sdk: MPFalso, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    clave_ajena = "clave-ajena-de-prueba"
    enviado = firmar("ord123", "req-1", TS, clave_ajena)

    response = post_webhook(client, "ORD123", secreto=clave_ajena)

    assert response.status_code == 401
    assert "req-1" in caplog.text  # el aviso identifica la notificación por su x-request-id
    _sin_secretos(caplog, clave_ajena, _v1_de(enviado), _v1_de(firmar("ord123", "req-1", TS, SECRETO)))


@pytest.mark.parametrize("status_http", [401, 500], ids=["401", "500"])
def test_los_errores_al_consultar_la_orden_no_filtran_secretos(
    client: TestClient, mp_sdk: MPFalso, caplog: pytest.LogCaptureFixture, status_http: int
) -> None:
    caplog.set_level(logging.DEBUG)
    mp_sdk.responder_consulta_error("ORD123", status_http)

    response = post_webhook(client, "ORD123")

    assert response.status_code in (502, 503)
    _sin_secretos(caplog, _v1_de(firmar("ord123", "req-1", TS, SECRETO)))


def test_el_monto_distinto_se_registra_sin_secretos(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    pedido = pedido_con_detalle(session, normal_user["id"], producto(session, "Monto logs", 5), 1, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1.00")

    response = post_webhook(client, "ORD123")

    assert response.status_code == 200
    _sin_secretos(caplog, _v1_de(firmar("ord123", "req-1", TS, SECRETO)))


def test_el_camino_feliz_no_filtra_secretos(
    client: TestClient,
    session: Session,
    user_auth_headers: dict,
    normal_user: dict,
    mp_sdk: MPFalso,
    pedido_a_cobrar,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    mp_sdk.responder_orden(order_id="ORD900", payment_id="PAY900")
    creado = client.post(CREAR, json=_cuerpo_crear(pedido_a_cobrar.id), headers=user_auth_headers)
    pedido = pedido_con_detalle(session, normal_user["id"], producto(session, "Feliz", 5), 1, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))

    notificado = post_webhook(client, "ORD123")

    assert (creado.status_code, notificado.status_code) == (201, 200)
    _sin_secretos(caplog, _v1_de(firmar("ord123", "req-1", TS, SECRETO)))
