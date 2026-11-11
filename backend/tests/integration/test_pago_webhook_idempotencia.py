"""Webhook de pagos: idempotencia por `mp_payment_id` y resolución del pago local (C-05, D5)."""
from fastapi.testclient import TestClient
from sqlalchemy import func
from sqlmodel import Session, select

from app.modules.pagos.models import Pago
from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import (
    estado_pedido,
    historial,
    pagos_de,
    pedido_con_detalle,
    pedido_con_pago,
    producto,
    stock_de,
)


def test_dos_entregas_del_mismo_pago_aprobado_confirman_una_sola_vez(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Idempotente", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder(123, str(pedido.id))

    primera = post_webhook(client, "123")
    segunda = post_webhook(client, "123")

    assert (primera.status_code, primera.json()["status"]) == (200, "processed")
    assert (segunda.status_code, segunda.json()["status"]) == (200, "already_processed")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert [(h.estado_desde, h.estado_hacia) for h in historial(session, pedido.id)] == [("PENDIENTE", "CONFIRMADO")]
    assert stock_de(session, prod.id) == 3


def test_nuevo_intento_aprobado_tras_un_rechazo_con_otro_id_confirma_el_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder(100, str(pedido.id), estado="rejected")
    mp_sdk.responder(101, str(pedido.id), estado="approved")
    rechazo = post_webhook(client, "100")

    aprobacion = post_webhook(client, "101")

    assert rechazo.json()["status"] == "processed"
    assert (aprobacion.status_code, aprobacion.json()["status"]) == (200, "processed")
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id) == ("aprobado", 101)
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_reentrega_de_un_pago_rechazado_con_el_mismo_id_no_cambia_nada(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder(100, str(pedido.id), estado="rejected")
    post_webhook(client, "100")
    antes = pagos_de(session, pedido.id)[0].updated_at

    reentrega = post_webhook(client, "100")

    assert reentrega.json()["status"] == "already_processed"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id, pago.updated_at) == ("rechazado", 100, antes)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_pago_aprobado_que_mercadopago_informa_reembolsado_no_cambia_pago_ni_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder(100, str(pedido.id), estado="approved")
    post_webhook(client, "100")
    mp_sdk.responder(100, str(pedido.id), estado="refunded")

    response = post_webhook(client, "100", request_id="req-2")

    assert response.json()["status"] == "already_processed"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("aprobado", "approved")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_referencia_externa_sin_pago_local_se_ignora_y_no_crea_filas(
    client: TestClient, session: Session, mp_sdk: MPFalso
) -> None:
    mp_sdk.responder(200, "999999")
    filas_antes = session.exec(select(func.count()).select_from(Pago)).one()

    response = post_webhook(client, "200")

    assert (response.status_code, response.json()["status"]) == (200, "ignored")
    assert session.exec(select(func.count()).select_from(Pago)).one() == filas_antes


def test_el_pago_se_resuelve_por_mp_payment_id_antes_que_por_la_referencia_externa(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    otro = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    pago = pagos_de(session, pedido.id)[0]
    pago.mp_payment_id = 300
    session.add(pago)
    session.commit()
    mp_sdk.responder(300, str(otro.id), estado="rejected")

    response = post_webhook(client, "300")

    assert response.json()["status"] == "processed"
    assert pagos_de(session, pedido.id)[0].mp_status == "rejected"
    assert pagos_de(session, otro.id)[0].mp_status is None
