"""`POST /pagos/crear` con Checkout API (token de tarjeta) y `GET /pagos/{pedido_id}` (C-12).

El borde de MercadoPago está mockeado con `MPFalso` (fixture `mp_sdk`, SDK parcheado en el adaptador). La firma del
webhook NO se mockea.
"""
import re
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.modules.pagos.models import Pago
from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import (
    estado_pedido,
    historial,
    pagos_de,
    pedido_a_pagar,
    pedido_sin_pagos,
    producto,
    stock_de,
)

CREAR = "/api/v1/pagos/crear"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def cuerpo(pedido_id: int, **cambios) -> dict:
    base = {
        "pedido_id": pedido_id,
        "token": "tok-1",
        "payment_method_id": "visa",
        "installments": 1,
        "issuer_id": 310,
        "payer": {"email": "a@test.com"},
    }
    return {**base, **cambios}


@pytest.fixture
def escenario(session: Session, normal_user: dict):
    """Producto con stock 5 y pedido `MERCADOPAGO` `PENDIENTE` de 2 unidades, sin pagos."""
    prod = producto(session, "Checkout", 5)
    pedido = pedido_a_pagar(session, normal_user["id"], prod, 2)
    return prod, pedido


# ── Aprobado ────────────────────────────────────────────────────────────────

def test_cobro_aprobado_responde_201_confirma_el_pedido_y_descuenta_stock(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=900)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 201
    assert (body["estado"], body["mp_status"], body["mp_status_detail"], body["mp_payment_id"]) == (
        "aprobado",
        "approved",
        "accredited",
        900,
    )
    assert body["pedido_id"] == pedido.id
    assert not {"preference_id", "init_point", "public_key"} & set(body)
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in historial(session, pedido.id)] == [
        ("PENDIENTE", "CONFIRMADO", None)
    ]
    assert stock_de(session, prod.id) == 3


def test_el_cobro_envia_a_mercadopago_los_datos_del_brick_el_monto_del_pedido_y_las_claves_del_intento(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion()

    client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    (creacion,) = mp_sdk.creaciones
    (pago,) = pagos_de(session, pedido.id)
    assert creacion.cuerpo["transaction_amount"] == 200.0  # el monto sale del pedido, nunca del cliente
    assert creacion.cuerpo["token"] == "tok-1"
    assert creacion.cuerpo["payer"]["email"] == "a@test.com"
    assert creacion.cuerpo["notification_url"] == settings.MP_NOTIFICATION_URL
    assert creacion.cuerpo["external_reference"] == str(pago.external_reference)
    assert creacion.idempotency_key == pago.idempotency_key
    assert UUID_RE.match(creacion.cuerpo["external_reference"])
    assert UUID_RE.match(pago.idempotency_key)
    assert str(pago.external_reference) != pago.idempotency_key


def test_webhook_firmado_posterior_a_un_aprobado_sincronico_responde_already_processed_sin_cambios(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=900)
    client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)
    (pago,) = pagos_de(session, pedido.id)
    mp_sdk.responder(900, str(pago.external_reference), "approved")

    response = post_webhook(client, "900")

    assert (response.status_code, response.json()["status"]) == (200, "already_processed")
    assert len(historial(session, pedido.id)) == 1
    assert stock_de(session, prod.id) == 3


# ── Rechazado / en proceso / sin stock ──────────────────────────────────────

def test_cobro_rechazado_responde_201_rechazado_y_deja_el_pedido_pendiente_sin_tocar_stock(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_creacion(201, "rejected", "cc_rejected_insufficient_amount", payment_id=901)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 201
    assert (body["estado"], body["mp_status_detail"]) == ("rechazado", "cc_rejected_insufficient_amount")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"
    assert stock_de(session, prod.id) == 5
    assert historial(session, pedido.id) == []


def test_cobro_en_proceso_responde_201_pendiente_con_el_id_de_mercadopago(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "in_process", "pending_contingency", payment_id=902)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 201
    assert (body["estado"], body["mp_payment_id"]) == ("pendiente", 902)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_estado_de_mercadopago_no_mapeado_responde_201_pendiente_y_registra_el_estado(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "in_mediation", "x", payment_id=903)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert response.status_code == 201
    assert response.json()["estado"] == "pendiente"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.mp_status, pago.mp_payment_id) == ("in_mediation", 903)


def test_aprobado_sin_stock_responde_201_a_devolver_y_cancela_el_pedido(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    prod = producto(session, "Agotado", 0)
    pedido = pedido_a_pagar(session, normal_user["id"], prod, 1)
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=904)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert response.status_code == 201
    assert response.json()["estado"] == "a_devolver"
    assert estado_pedido(session, pedido.id) == "CANCELADO"
    assert [h.motivo for h in historial(session, pedido.id)] == ["Sin stock"]
    assert stock_de(session, prod.id) == 0


# ── Precondiciones (409) y orden de verificaciones ──────────────────────────

def test_pedido_en_efectivo_responde_409_payment_not_allowed_sin_crear_pagos_ni_llamar_a_mp(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    pedido = pedido_a_pagar(session, normal_user["id"], producto(session, "Efvo", 5), forma_pago="EFECTIVO")

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert response.status_code == 409
    assert response.json()["code"] == "PAYMENT_NOT_ALLOWED"
    assert response.json()["field"] is None
    assert pagos_de(session, pedido.id) == []
    assert mp_sdk.creaciones == []


def test_pedido_por_transferencia_responde_409(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    pedido = pedido_a_pagar(session, normal_user["id"], producto(session, "Transf", 5), forma_pago="TRANSFERENCIA")

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert (response.status_code, response.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")


def test_pedido_cancelado_responde_409(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict
) -> None:
    pedido = pedido_sin_pagos(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert (response.status_code, response.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")
    assert mp_sdk.creaciones == []


def test_pedido_ya_pagado_responde_409_y_sigue_con_un_solo_pago(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=905)
    client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert (response.status_code, response.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")
    assert len(pagos_de(session, pedido.id)) == 1
    assert len(mp_sdk.creaciones) == 1


def test_pago_en_proceso_en_mercadopago_responde_409_sin_llamar_a_mp(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "in_process", "pending_contingency", payment_id=555)
    client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    response = client.post(CREAR, json=cuerpo(pedido.id, token="tok-2"), headers=user_auth_headers)

    assert (response.status_code, response.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")
    assert len(mp_sdk.creaciones) == 1


def test_pedido_en_efectivo_sin_access_token_responde_409_y_no_503(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, normal_user: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", None)
    pedido = pedido_a_pagar(session, normal_user["id"], producto(session, "Efvo2", 5), forma_pago="EFECTIVO")

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert (response.status_code, response.json()["code"]) == (409, "PAYMENT_NOT_ALLOWED")


def test_otro_cliente_sobre_un_pedido_ya_pagado_recibe_403_y_no_409(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario, usuario_con_roles
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=906)
    client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)
    _, headers_b = usuario_con_roles(["CLIENT"])

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=headers_b)

    assert response.status_code == 403
    assert len(mp_sdk.creaciones) == 1


# ── Contrato de entrada ─────────────────────────────────────────────────────

@pytest.mark.parametrize(
    ("campo", "valor_invalido"),
    [("token", None), ("installments", 0), ("payment_method_id", None), ("payer", None)],
)
def test_cuerpo_invalido_responde_422_nombrando_el_campo_sin_crear_pagos_ni_llamar_a_mp(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario,
    campo: str, valor_invalido,
) -> None:
    _, pedido = escenario
    datos = cuerpo(pedido.id)
    if valor_invalido is None:
        del datos[campo]
    else:
        datos[campo] = valor_invalido

    response = client.post(CREAR, json=datos, headers=user_auth_headers)

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["field"] == campo
    assert pagos_de(session, pedido.id) == []
    assert mp_sdk.creaciones == []


def test_un_campo_de_tarjeta_fuera_del_contrato_responde_422_sin_crear_pagos_ni_llamar_a_mp(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario

    response = client.post(
        CREAR, json=cuerpo(pedido.id, card_number="4509953566233704"), headers=user_auth_headers
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert pagos_de(session, pedido.id) == []
    assert mp_sdk.creaciones == []


# ── Consulta ────────────────────────────────────────────────────────────────

def test_consulta_con_ultimo_intento_rechazado_expone_el_detalle_de_mercadopago(
    client: TestClient, session: Session, user_auth_headers: dict, normal_user: dict
) -> None:
    pedido = pedido_a_pagar(session, normal_user["id"], producto(session, "Consulta", 5))
    session.add(
        Pago(
            pedido_id=pedido.id,
            transaction_amount="100.00",
            estado="rechazado",
            mp_status="rejected",
            mp_status_detail="cc_rejected_bad_filled_security_code",
            idempotency_key="k-consulta-1",
        )
    )
    session.commit()

    response = client.get(f"/api/v1/pagos/{pedido.id}", headers=user_auth_headers)

    pago = pagos_de(session, pedido.id)[0]
    assert response.status_code == 200
    assert response.json() == {
        "pedido_id": pedido.id,
        "pago_id": pago.id,
        "estado": "rechazado",
        "mp_status": "rejected",
        "mp_status_detail": "cc_rejected_bad_filled_security_code",
    }


def test_consulta_de_un_pedido_sin_intentos_devuelve_los_cuatro_campos_nulos(
    client: TestClient, session: Session, user_auth_headers: dict, escenario
) -> None:
    _, pedido = escenario

    response = client.get(f"/api/v1/pagos/{pedido.id}", headers=user_auth_headers)

    assert response.json() == {
        "pedido_id": pedido.id,
        "pago_id": None,
        "estado": None,
        "mp_status": None,
        "mp_status_detail": None,
    }


# ── Retiro de Checkout Pro ──────────────────────────────────────────────────

@pytest.mark.parametrize("status", ["success", "failure", "pending"])
def test_la_ruta_de_redirect_de_checkout_pro_ya_no_existe(client: TestClient, status: str) -> None:
    response = client.get(f"/api/v1/pagos/redirect/1/{status}", follow_redirects=False)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"
    assert "location" not in response.headers


# ── Reintento tras rechazo (D6) ─────────────────────────────────────────────

def test_rechazo_y_reintento_con_otro_token_aprobado_crea_dos_intentos_con_claves_distintas(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion(201, "rejected", "cc_rejected_other_reason", payment_id=910)
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=911)

    primero = client.post(CREAR, json=cuerpo(pedido.id, token="tok-1"), headers=user_auth_headers)
    segundo = client.post(CREAR, json=cuerpo(pedido.id, token="tok-2"), headers=user_auth_headers)

    assert (primero.json()["estado"], segundo.status_code, segundo.json()["estado"]) == ("rechazado", 201, "aprobado")
    rechazado, aprobado = pagos_de(session, pedido.id)
    assert (rechazado.estado, aprobado.estado) == ("rechazado", "aprobado")
    assert rechazado.idempotency_key != aprobado.idempotency_key
    assert rechazado.external_reference != aprobado.external_reference
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert mp_sdk.creaciones[1].cuerpo["token"] == "tok-2"
    consulta = client.get(f"/api/v1/pagos/{pedido.id}", headers=user_auth_headers).json()
    assert (consulta["pago_id"], consulta["estado"]) == (aprobado.id, "aprobado")


# ── Reintento tras resultado desconocido (D6) ───────────────────────────────

def test_mercadopago_sin_respuesta_responde_502_y_deja_un_intento_pendiente_reutilizable(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.fallar_creacion(OSError("sin red"))

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert response.status_code == 502
    assert response.json()["code"] == "HTTP_502"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id) == ("pendiente", None)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_reintento_tras_un_502_reutiliza_el_intento_y_su_clave_de_idempotencia(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.fallar_creacion(OSError("sin red"))
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=912)
    client.post(CREAR, json=cuerpo(pedido.id, token="tok-1"), headers=user_auth_headers)

    response = client.post(CREAR, json=cuerpo(pedido.id, token="tok-2"), headers=user_auth_headers)

    assert (response.status_code, response.json()["estado"]) == (201, "aprobado")
    (pago,) = pagos_de(session, pedido.id)
    primera, segunda = mp_sdk.creaciones
    assert primera.idempotency_key == segunda.idempotency_key == pago.idempotency_key
    assert primera.cuerpo["external_reference"] == segunda.cuerpo["external_reference"] == str(pago.external_reference)
    assert segunda.cuerpo["token"] == "tok-2"


def test_mercadopago_500_responde_502_y_el_intento_sigue_reutilizable(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion_error(500, "internal_error")
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=913)

    primero = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)
    segundo = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert (primero.status_code, primero.json()["code"]) == (502, "HTTP_502")
    assert segundo.status_code == 201
    assert len(pagos_de(session, pedido.id)) == 1


# ── Datos rechazados por MercadoPago (4xx) ──────────────────────────────────

def test_mercadopago_400_responde_400_sin_exponer_credenciales_y_marca_el_intento_rechazado(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion_error(400, "invalid_token")

    response = client.post(CREAR, json=cuerpo(pedido.id, token="tok-secreto"), headers=user_auth_headers)

    assert response.status_code == 400
    assert response.json()["code"] == "HTTP_400"
    assert "tok-secreto" not in response.text
    assert "TEST-token" not in response.text
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id, pago.mp_status_detail) == ("rechazado", None, "invalid_token")
    assert estado_pedido(session, pedido.id) == "PENDIENTE"


def test_reintento_tras_datos_rechazados_con_otro_token_crea_un_segundo_intento_con_claves_nuevas(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    _, pedido = escenario
    mp_sdk.responder_creacion_error(400, "invalid_token")
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=914)
    client.post(CREAR, json=cuerpo(pedido.id, token="tok-usado"), headers=user_auth_headers)

    response = client.post(CREAR, json=cuerpo(pedido.id, token="tok-nuevo"), headers=user_auth_headers)

    assert response.status_code == 201
    primero, segundo = pagos_de(session, pedido.id)
    assert primero.idempotency_key != segundo.idempotency_key
    assert (primero.estado, segundo.estado) == ("rechazado", "aprobado")


# ── Carrera crear ↔ webhook (D4, D7) ────────────────────────────────────────

def test_si_el_webhook_procesa_el_pago_antes_que_crear_este_responde_aprobado_sin_duplicar_efectos(
    client: TestClient, session: Session, user_auth_headers: dict, mp_sdk: MPFalso, escenario
) -> None:
    prod, pedido = escenario
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=920)
    respuestas_webhook: list[dict] = []

    def webhook_gana_la_carrera(creacion) -> None:
        mp_sdk.responder(920, creacion.cuerpo["external_reference"], "approved")
        respuestas_webhook.append(post_webhook(client, "920").json())

    mp_sdk.antes_de_responder_creacion(webhook_gana_la_carrera)

    response = client.post(CREAR, json=cuerpo(pedido.id), headers=user_auth_headers)

    assert [r["status"] for r in respuestas_webhook] == ["processed"]
    assert (response.status_code, response.json()["estado"], response.json()["mp_payment_id"]) == (201, "aprobado", 920)
    assert [(h.estado_hacia, h.usuario_id) for h in historial(session, pedido.id)] == [("CONFIRMADO", None)]
    assert stock_de(session, prod.id) == 3
    assert len(pagos_de(session, pedido.id)) == 1
