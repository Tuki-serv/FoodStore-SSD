"""Control del monto: un pago `aprobado` solo confirma el pedido si el `total_amount` de la orden es el del intento local."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import (
    estado_pedido,
    historial,
    pagos_de,
    pedido_a_pagar,
    pedido_con_detalle,
    producto,
    referencia_de,
    stock_de,
)

CREAR = "/api/v1/pagos/crear"


def _cuerpo_crear(pedido_id: int) -> dict:
    return {
        "pedido_id": pedido_id,
        "token": "tok-1",
        "payment_method_id": "visa",
        "payment_type_id": "credit_card",
        "installments": 1,
        "payer": {"email": "a@test.com"},
    }


@pytest.fixture(name="escenario")
def escenario_fixture(session: Session, normal_user: dict):
    """Producto con stock 5 y pedido `MERCADOPAGO` `PENDIENTE` de 1500.00 con un intento `pendiente`."""
    prod = producto(session, "Monto", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    return prod, pedido


def _sin_cambios_en_el_pedido(session: Session, prod, pedido) -> None:
    assert estado_pedido(session, pedido.id) == "PENDIENTE"
    assert historial(session, pedido.id) == []
    assert stock_de(session, prod.id) == 5


# ── Webhook ─────────────────────────────────────────────────────────────────


def test_monto_igual_confirma_el_pedido(client: TestClient, session: Session, mp_sdk: MPFalso, escenario) -> None:
    prod, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1500.00")

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert pago.estado == "aprobado"
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert stock_de(session, prod.id) == 3


def test_monto_igual_con_otra_escala_confirma_el_pedido(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1500")

    post_webhook(client, "ORD123")

    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_monto_distinto_en_el_webhook_deja_el_pago_a_devolver_y_el_pedido_sin_cambios(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario, caplog: pytest.LogCaptureFixture
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1.00")

    with caplog.at_level("WARNING"):
        response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_order_id, pago.mp_status) == ("a_devolver", "ORD123", "processed")
    _sin_cambios_en_el_pedido(session, prod, pedido)
    aviso = [r for r in caplog.records if r.levelname == "WARNING" and "monto" in r.getMessage().lower()]
    assert len(aviso) == 1
    assert str(pago.id) in aviso[0].getMessage()
    assert "1500.00" in aviso[0].getMessage() and "1.00" in aviso[0].getMessage()


def test_monto_distinto_por_un_centavo_tambien_queda_a_devolver(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1499.99")

    post_webhook(client, "ORD123")

    assert pagos_de(session, pedido.id)[0].estado == "a_devolver"
    _sin_cambios_en_el_pedido(session, prod, pedido)


def test_orden_sin_monto_deja_el_pago_a_devolver(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount=None)

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()["status"]) == (200, "processed")
    assert pagos_de(session, pedido.id)[0].estado == "a_devolver"
    _sin_cambios_en_el_pedido(session, prod, pedido)


def test_la_reentrega_de_un_monto_distinto_responde_already_processed(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), total_amount="1.00")
    post_webhook(client, "ORD123")

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "already_processed"})


def test_rechazo_con_monto_distinto_queda_rechazado(
    client: TestClient, session: Session, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), "failed", total_amount="1.00")

    post_webhook(client, "ORD123")

    assert pagos_de(session, pedido.id)[0].estado == "rechazado"
    _sin_cambios_en_el_pedido(session, prod, pedido)


# ── Creación sincrónica ─────────────────────────────────────────────────────


def test_monto_distinto_en_la_creacion_responde_201_a_devolver_y_el_reintento_409(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    prod = producto(session, "Creacion", 5)
    pedido = pedido_a_pagar(session, normal_user["id"], prod, 15)  # total 1500.00
    mp_sdk.responder_orden(order_id="ORD900", payment_id="PAY900", total_amount="1499.99")

    response = client.post(CREAR, json=_cuerpo_crear(pedido.id), headers=user_auth_headers)

    assert response.status_code == 201
    assert response.json()["estado"] == "a_devolver"
    _sin_cambios_en_el_pedido(session, prod, pedido)

    reintento = client.post(CREAR, json=_cuerpo_crear(pedido.id), headers=user_auth_headers)

    assert (reintento.status_code, reintento.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")
    assert len(mp_sdk.creaciones) == 1
