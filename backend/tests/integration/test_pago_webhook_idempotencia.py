"""Webhook de pagos: idempotencia por `mp_order_id` y resolución del pago local (C-05, D5)."""
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
    referencia_de,
    stock_de,
)


def test_dos_entregas_del_mismo_pago_aprobado_confirman_una_sola_vez(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Idempotente", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD123", referencia_de(session, pedido.id))

    primera = post_webhook(client, "ORD123")
    segunda = post_webhook(client, "ORD123")

    assert (primera.status_code, primera.json()["status"]) == (200, "processed")
    assert (segunda.status_code, segunda.json()["status"]) == (200, "already_processed")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert [(h.estado_desde, h.estado_hacia) for h in historial(session, pedido.id)] == [("PENDIENTE", "CONFIRMADO")]
    assert stock_de(session, prod.id) == 3


def test_nuevo_intento_aprobado_tras_un_rechazo_con_otro_id_confirma_el_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD100", referencia_de(session, pedido.id), "failed")
    mp_sdk.responder_consulta("ORD101", referencia_de(session, pedido.id), "processed")
    rechazo = post_webhook(client, "ORD100")

    aprobacion = post_webhook(client, "ORD101")

    assert rechazo.json()["status"] == "processed"
    assert (aprobacion.status_code, aprobacion.json()["status"]) == (200, "processed")
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_order_id) == ("aprobado", "ORD101")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_reentrega_de_un_pago_rechazado_con_el_mismo_id_no_cambia_nada(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD100", referencia_de(session, pedido.id), "failed")
    post_webhook(client, "ORD100")
    antes = pagos_de(session, pedido.id)[0].updated_at

    reentrega = post_webhook(client, "ORD100")

    assert reentrega.json()["status"] == "already_processed"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_order_id, pago.updated_at) == ("rechazado", "ORD100", antes)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_pago_aprobado_que_mercadopago_informa_reembolsado_no_cambia_pago_ni_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD100", referencia_de(session, pedido.id), "processed")
    post_webhook(client, "ORD100")
    mp_sdk.responder_consulta("ORD100", referencia_de(session, pedido.id), "refunded")

    response = post_webhook(client, "ORD100", request_id="req-2")

    assert response.json()["status"] == "already_processed"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status) == ("aprobado", "processed")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_referencia_externa_sin_pago_local_se_ignora_y_no_crea_filas(
    client: TestClient, session: Session, mp_sdk: MPFalso
) -> None:
    mp_sdk.responder_consulta("ORD200", "999999")
    filas_antes = session.exec(select(func.count()).select_from(Pago)).one()

    response = post_webhook(client, "ORD200")

    assert (response.status_code, response.json()["status"]) == (200, "ignored")
    assert session.exec(select(func.count()).select_from(Pago)).one() == filas_antes


def test_el_pago_se_resuelve_por_mp_order_id_antes_que_por_la_referencia_externa(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    otro = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    pago = pagos_de(session, pedido.id)[0]
    pago.mp_order_id = "ORD300"
    session.add(pago)
    session.commit()
    mp_sdk.responder_consulta("ORD300", referencia_de(session, otro.id), "failed")

    response = post_webhook(client, "ORD300")

    assert response.json()["status"] == "processed"
    assert pagos_de(session, pedido.id)[0].mp_status == "failed"
    assert pagos_de(session, otro.id)[0].mp_status is None


# ── Asociación por `external_reference` UUID (C-12, D9) ─────────────────────

def _dos_intentos(session: Session, pedido, mp_id_1: str, estado_1: str = "rechazado") -> tuple[Pago, Pago]:
    """Intento 1 con resultado conocido e intento 2 `pendiente` sin orden de MercadoPago (el último del pedido)."""
    (viejo,) = pagos_de(session, pedido.id)
    viejo.estado, viejo.mp_order_id, viejo.mp_status = estado_1, mp_id_1, "failed"
    nuevo = Pago(pedido_id=pedido.id, transaction_amount="1500.00", idempotency_key="idem-intento-2")
    session.add_all([viejo, nuevo])
    session.commit()
    return viejo, nuevo


def test_notificacion_de_un_pago_desconocido_se_asocia_al_intento_de_su_referencia_y_confirma_el_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    _, intento2 = _dos_intentos(session, pedido, "ORD600")
    mp_sdk.responder_consulta("ORD700", str(intento2.external_reference), "processed")

    response = post_webhook(client, "ORD700")

    assert (response.status_code, response.json()["status"]) == (200, "processed")
    uno, dos = pagos_de(session, pedido.id)
    assert (uno.estado, uno.mp_order_id) == ("rechazado", "ORD600")
    assert (dos.estado, dos.mp_order_id) == ("aprobado", "ORD700")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"


def test_notificacion_con_la_referencia_de_un_intento_viejo_no_toca_al_ultimo_del_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    intento1, _ = _dos_intentos(session, pedido, "ORD600", estado_1="pendiente")
    mp_sdk.responder_consulta("ORD800", str(intento1.external_reference), "failed")

    response = post_webhook(client, "ORD800")

    assert response.json()["status"] == "processed"
    uno, dos = pagos_de(session, pedido.id)
    assert (uno.estado, uno.mp_order_id) == ("rechazado", "ORD800")
    assert (dos.estado, dos.mp_order_id, dos.mp_status) == ("pendiente", None, None)


def test_referencia_numerica_heredada_se_ignora_y_no_cambia_nada(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD900", str(pedido.id), "processed")  # id de pedido, como en Checkout Pro

    response = post_webhook(client, "ORD900")

    assert (response.status_code, response.json()["status"]) == (200, "ignored")
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_order_id) == ("pendiente", None)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_referencia_uuid_de_un_intento_inexistente_se_ignora(
    client: TestClient, session: Session, mp_sdk: MPFalso
) -> None:
    from uuid import uuid4

    mp_sdk.responder_consulta("ORD901", str(uuid4()), "processed")

    response = post_webhook(client, "ORD901")

    assert (response.status_code, response.json()["status"]) == (200, "ignored")


# ── Estado de la orden: siempre se consulta, nunca se confía en el cuerpo (D23) ─────────────────────────

def test_el_cuerpo_dice_processed_pero_la_consulta_informa_failed_el_pago_queda_rechazado(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder_consulta("ORD400", referencia_de(session, pedido.id), "failed", "insufficient_amount")

    response = post_webhook(
        client, "ORD400", body={"type": "order", "action": "order.processed", "data": {"id": "ORD400", "status": "processed"}}
    )

    assert response.json()["status"] == "processed"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_status, pago.mp_status_detail) == ("rechazado", "failed", "insufficient_amount")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_orden_en_proceso_y_luego_procesada_pasa_de_pendiente_a_aprobado_y_confirma_el_pedido(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    referencia = referencia_de(session, pedido.id)
    mp_sdk.responder_consulta("ORD500", referencia, "processing")
    en_proceso = post_webhook(client, "ORD500")
    mp_sdk.responder_consulta("ORD500", referencia, "processed")

    procesada = post_webhook(client, "ORD500", request_id="req-2")

    assert (en_proceso.json()["status"], procesada.json()["status"]) == ("processed", "processed")
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_order_id, pago.mp_status) == ("aprobado", "ORD500", "processed")
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
