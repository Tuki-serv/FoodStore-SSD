"""Estados de la orden de MercadoPago por endpoint: cada estado informado deja el pago y el pedido como dice la spec."""
from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import (
    estado_pedido,
    historial,
    pagos_de,
    pedido_a_pagar,
    pedido_con_detalle,
    pedido_con_pago,
    producto,
    referencia_de,
    stock_de,
)

CREAR = "/api/v1/pagos/crear"


def test_orden_cancelada_informada_por_el_webhook_deja_el_pago_rechazado_y_el_pedido_pendiente(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "canceled", "expired")

    response = post_webhook(client, "ORD01AAA")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status, pago.mp_status_detail) == ("rechazado", "canceled", "expired")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_contracargo_sobre_un_pago_no_aprobado_lo_deja_rechazado_y_el_pedido_pendiente(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "charged_back")

    post_webhook(client, "ORD01AAA")

    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("rechazado", "charged_back")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_orden_creada_informada_por_el_webhook_deja_el_pago_pendiente_con_su_estado(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "created")

    response = post_webhook(client, "ORD01AAA")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("pendiente", "created")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_orden_recien_creada_en_la_creacion_responde_201_pendiente_created(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    pedido = pedido_a_pagar(session, normal_user["id"], producto(session, "Creada", 5), 2)
    mp_sdk.responder_orden(201, "created", "created", "ready_to_process", order_id="ORD01AAA", payment_id="PAY01AAA")
    cuerpo = {
        "pedido_id": pedido.id,
        "token": "tok-1",
        "payment_method_id": "visa",
        "payment_type_id": "credit_card",
        "installments": 1,
        "payer": {"email": "a@test.com"},
    }

    response = client.post(CREAR, json=cuerpo, headers=user_auth_headers)

    assert response.status_code == 201
    assert (response.json()["estado"], response.json()["mp_status"]) == ("pendiente", "created")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_orden_reembolsada_en_parte_antes_de_la_primera_notificacion_confirma_el_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Reembolso parcial", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "partially_refunded")

    response = post_webhook(client, "ORD01AAA")

    assert (response.status_code, response.json()) == (200, {"status": "processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("aprobado", "partially_refunded")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert [(h.estado_hacia, h.usuario_id) for h in historial(session, pedido.id)] == [("CONFIRMADO", None)]
    assert stock_de(session, prod.id) == 3


def test_reembolso_parcial_de_un_pago_ya_aprobado_responde_already_processed_sin_cambios(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Aprobado luego reembolsado", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "processed")
    post_webhook(client, "ORD01AAA")
    mp_sdk.responder_consulta("ORD01AAA", referencia_de(session, pedido.id), "partially_refunded")

    response = post_webhook(client, "ORD01AAA")

    assert (response.status_code, response.json()) == (200, {"status": "already_processed"})
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("aprobado", "processed")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert len(historial(session, pedido.id)) == 1
