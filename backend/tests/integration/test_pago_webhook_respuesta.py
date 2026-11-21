"""Webhook de pagos: el cuerpo de toda respuesta 200 es exactamente `{"status": ...}`, sin datos del pago ni del pedido."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import pedido_con_detalle, pedido_con_pago, producto, referencia_de


def _pedido_a_confirmar(session: Session, normal_user: dict):
    prod = producto(session, "Respuesta", 5)
    return pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")


def test_el_webhook_que_confirma_el_pedido_responde_solo_el_status(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = _pedido_a_confirmar(session, normal_user)
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})


def test_la_reentrega_responde_solo_already_processed(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = _pedido_a_confirmar(session, normal_user)
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))
    post_webhook(client, "ORD123")

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "already_processed"})


def test_una_orden_sin_pago_local_responde_solo_ignored(client: TestClient, mp_sdk: MPFalso) -> None:
    mp_sdk.responder_consulta("ORD404", "00000000-0000-0000-0000-000000000000")

    response = post_webhook(client, "ORD404")

    assert (response.status_code, response.json()) == (200, {"status": "ignored"})


def test_un_topico_distinto_de_order_responde_solo_ignored(client: TestClient, mp_sdk: MPFalso) -> None:
    response = post_webhook(client, "123", topic="payment")

    assert (response.status_code, response.json()) == (200, {"status": "ignored"})
    assert mp_sdk.llamadas == []


def test_un_estado_de_orden_no_mapeado_responde_solo_ignored(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id), "in_mediation")

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "ignored"})


def test_un_pago_a_devolver_por_pedido_cancelado_responde_solo_processed(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))

    response = post_webhook(client, "ORD123")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
