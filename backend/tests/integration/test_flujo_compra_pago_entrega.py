"""Flujo e2e compra -> pago -> entrega, solo por HTTP (C-25a, D9).

Test de caracterización: el único doble es el SDK de MercadoPago (`mp_sdk`). La firma del webhook es real.
Protege el flujo completo mientras se mueven módulos y capas.
"""
import pytest
from fastapi.testclient import TestClient

from tests.support.mp_webhook import MPFalso, post_webhook

pytestmark = pytest.mark.e2e

STOCK_INICIAL = 5
CANTIDAD = 2
ORDEN_ID = "ORD7001"
PAGO_ID = "PAY7001"


def _crear_catalogo(client: TestClient, admin: dict) -> int:
    categoria = client.post(
        "/api/v1/categorias/", json={"nombre": "Cat e2e", "imagen_url": "http://img.test/c.png"}, headers=admin
    )
    assert categoria.status_code == 201
    producto = client.post(
        "/api/v1/productos/",
        json={
            "nombre": "Hamburguesa e2e",
            "precio_base": "100.00",
            "stock_cantidad": STOCK_INICIAL,
            "categoria_ids": [categoria.json()["id"]],
        },
        headers=admin,
    )
    assert producto.status_code == 201
    return producto.json()["id"]


def _stock(client: TestClient, admin: dict, producto_id: int) -> int:
    response = client.get(f"/api/v1/productos/{producto_id}", headers=admin)
    assert response.status_code == 200
    return response.json()["stock_cantidad"]


def _cliente_con_pedido(client: TestClient, producto_id: int) -> tuple[dict, int]:
    """El cliente se registra, inicia sesión, crea su dirección y un pedido `MERCADOPAGO` de `CANTIDAD` unidades."""
    datos = {
        "email": "e2e@example.com",
        "password": "E2ePass123!",
        "nombre": "Ana",
        "apellido": "E2E",
        "celular": "123123",
    }
    assert client.post("/api/v1/auth/register", json=datos).status_code == 201
    login = client.post("/api/v1/auth/login", data={"username": datos["email"], "password": datos["password"]})
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    direccion = client.post(
        "/api/v1/direcciones/", json={"linea1": "Calle Falsa 123", "ciudad": "Mendoza"}, headers=headers
    )
    assert direccion.status_code == 201
    pedido = client.post(
        "/api/v1/pedidos/",
        json={
            "direccion_id": direccion.json()["id"],
            "forma_pago_codigo": "MERCADOPAGO",
            "items": [{"producto_id": producto_id, "cantidad": CANTIDAD}],
        },
        headers=headers,
    )
    assert pedido.status_code == 201
    assert pedido.json()["estado_codigo"] == "PENDIENTE"
    return headers, pedido.json()["id"]


def _pagar(client: TestClient, headers: dict, pedido_id: int, mp_sdk: MPFalso, estado: str):
    if estado == "approved":
        mp_sdk.responder_orden(order_id=ORDEN_ID, payment_id=PAGO_ID)
    else:
        mp_sdk.responder_orden(402, "failed", "failed", "other_reason", order_id=ORDEN_ID, payment_id=PAGO_ID)
    return client.post(
        "/api/v1/pagos/crear",
        json={
            "pedido_id": pedido_id,
            "token": "tok-e2e",
            "payment_method_id": "visa",
            "payment_type_id": "credit_card",
            "installments": 1,
            "issuer_id": 310,
            "payer": {"email": "e2e@example.com"},
        },
        headers=headers,
    )


def test_pedido_pagado_con_mercadopago_llega_a_entregado_y_descuenta_el_stock_una_sola_vez(
    client: TestClient, admin_auth_headers: dict, usuario_con_roles, mp_sdk: MPFalso
) -> None:
    producto_id = _crear_catalogo(client, admin_auth_headers)
    headers, pedido_id = _cliente_con_pedido(client, producto_id)

    pago = _pagar(client, headers, pedido_id, mp_sdk, "approved")

    assert pago.status_code == 201
    assert pago.json()["estado"] == "aprobado"
    assert _stock(client, admin_auth_headers, producto_id) == STOCK_INICIAL - CANTIDAD

    referencia = mp_sdk.creaciones[0].cuerpo["external_reference"]
    mp_sdk.responder_consulta(ORDEN_ID, referencia, "processed")
    primera = post_webhook(client, ORDEN_ID)
    repetida = post_webhook(client, ORDEN_ID)
    assert (primera.status_code, repetida.status_code) == (200, 200)
    assert repetida.json()["status"] == "already_processed"
    assert _stock(client, admin_auth_headers, producto_id) == STOCK_INICIAL - CANTIDAD

    _, pedidos_headers = usuario_con_roles(["PEDIDOS"])
    for destino in ("EN_PREP", "EN_CAMINO", "ENTREGADO"):
        avance = client.patch(
            f"/api/v1/pedidos/{pedido_id}/estado", json={"nuevo_estado": destino}, headers=pedidos_headers
        )
        assert avance.status_code == 200, avance.text
        assert avance.json()["estado_codigo"] == destino

    detalle = client.get(f"/api/v1/pedidos/{pedido_id}", headers=headers)
    historial = client.get(f"/api/v1/pedidos/{pedido_id}/historial", headers=headers)
    estado_pago = client.get(f"/api/v1/pagos/{pedido_id}", headers=headers)
    assert detalle.json()["estado_codigo"] == "ENTREGADO"
    assert [h["estado_hacia"] for h in historial.json()] == [
        "PENDIENTE",
        "CONFIRMADO",
        "EN_PREP",
        "EN_CAMINO",
        "ENTREGADO",
    ]
    assert estado_pago.json()["estado"] == "aprobado"
    assert _stock(client, admin_auth_headers, producto_id) == STOCK_INICIAL - CANTIDAD


def test_pago_rechazado_deja_el_pedido_pendiente_sin_descontar_stock_y_el_cliente_puede_cancelarlo(
    client: TestClient, admin_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    producto_id = _crear_catalogo(client, admin_auth_headers)
    headers, pedido_id = _cliente_con_pedido(client, producto_id)

    pago = _pagar(client, headers, pedido_id, mp_sdk, "rejected")

    assert pago.json()["estado"] == "rechazado"
    assert client.get(f"/api/v1/pedidos/{pedido_id}", headers=headers).json()["estado_codigo"] == "PENDIENTE"
    assert _stock(client, admin_auth_headers, producto_id) == STOCK_INICIAL

    cancelacion = client.request(
        "DELETE", f"/api/v1/pedidos/{pedido_id}", json={"motivo": "pago rechazado"}, headers=headers
    )

    assert cancelacion.status_code == 200, cancelacion.text
    assert client.get(f"/api/v1/pedidos/{pedido_id}", headers=headers).json()["estado_codigo"] == "CANCELADO"
    assert _stock(client, admin_auth_headers, producto_id) == STOCK_INICIAL
