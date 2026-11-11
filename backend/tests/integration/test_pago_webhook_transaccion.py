"""Webhook de pagos: una sola transacción (pago + pedido + stock + historial) y pagos no confirmables (C-05, D6/D7)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.main import app
from app.modules.pagos.router import get_payment_service
from app.modules.pagos.service import PaymentService
from app.modules.pedidos.service import PedidoService, descontar_stock_al_confirmar
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
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


def _inyectar_falla_en_la_confirmacion(session: Session) -> None:
    """El paso de confirmación descuenta el stock y después falla: simula una caída a mitad de la transacción."""

    def servicio_con_falla() -> PaymentService:
        def al_confirmar(uow, pedido) -> None:
            descontar_stock_al_confirmar(uow, pedido)
            raise RuntimeError("falla inyectada a mitad de la confirmación")

        return PaymentService(session, construir_pedidos=lambda s: PedidoService(PedidoUnitOfWork(s), al_confirmar=al_confirmar))

    app.dependency_overrides[get_payment_service] = servicio_con_falla


def test_falla_a_mitad_de_la_confirmacion_responde_500_y_no_deja_cambios_parciales(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Transaccional", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))
    _inyectar_falla_en_la_confirmacion(session)

    response = post_webhook(TestClient(app, raise_server_exceptions=False), "123")

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id) == ("pendiente", None)
    assert estado_pedido(session, pedido.id) == "PENDIENTE"
    assert historial(session, pedido.id) == []
    assert stock_de(session, prod.id) == 5


def test_reenviar_la_notificacion_tras_la_falla_confirma_una_sola_vez_como_sistema(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Reintento", 5)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))
    _inyectar_falla_en_la_confirmacion(session)
    post_webhook(TestClient(app, raise_server_exceptions=False), "123")
    del app.dependency_overrides[get_payment_service]

    response = post_webhook(client, "123")

    assert (response.status_code, response.json()["status"]) == (200, "processed")
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id) == ("aprobado", 123)
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert stock_de(session, prod.id) == 3
    assert [(h.estado_hacia, h.usuario_id) for h in historial(session, pedido.id)] == [("CONFIRMADO", None)]


# ─── Pagos aprobados que el Sistema no puede confirmar (D7) ───────────────────
def test_pago_aprobado_de_un_pedido_cancelado_queda_a_devolver_y_el_pedido_no_cambia(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))

    response = post_webhook(client, "123")

    assert response.status_code == 200
    assert "pedido_actualizado" not in response.json()
    assert estado_pedido(session, pedido.id) == "CANCELADO"
    assert historial(session, pedido.id) == []
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id, pago.mp_status) == ("a_devolver", 123, "approved")


def test_pago_aprobado_de_un_pedido_efectivo_queda_a_devolver_y_el_dueno_lo_consulta(
    client: TestClient, session: Session, normal_user: dict, user_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))

    response = post_webhook(client, "123")
    consulta = client.get(f"/api/v1/pagos/{pedido.id}", headers=user_auth_headers)

    assert response.status_code == 200
    assert estado_pedido(session, pedido.id) == "PENDIENTE"
    assert historial(session, pedido.id) == []
    assert consulta.json()["estado"] == "a_devolver"


def test_pago_aprobado_de_un_pedido_ya_confirmado_por_otra_via_queda_a_devolver(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "CONFIRMADO", "MERCADOPAGO")
    mp_sdk.responder(101, referencia_de(session, pedido.id))

    response = post_webhook(client, "101")

    assert response.status_code == 200
    assert estado_pedido(session, pedido.id) == "CONFIRMADO"
    assert historial(session, pedido.id) == []
    (pago,) = pagos_de(session, pedido.id)
    assert (pago.estado, pago.mp_payment_id) == ("a_devolver", 101)


def test_pago_aprobado_sin_stock_cancela_el_pedido_y_deja_el_pago_a_devolver(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    prod = producto(session, "Agotado", 1)
    pedido = pedido_con_detalle(session, normal_user["id"], prod, 2, "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))

    response = post_webhook(client, "123")

    assert response.status_code == 200
    assert estado_pedido(session, pedido.id) == "CANCELADO"
    (fila,) = historial(session, pedido.id)
    assert (fila.estado_hacia, fila.motivo, fila.usuario_id) == ("CANCELADO", "Sin stock", None)
    assert pagos_de(session, pedido.id)[0].estado == "a_devolver"
    assert stock_de(session, prod.id) == 1


def test_reentrega_del_pago_a_devolver_no_cambia_nada(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso
) -> None:
    pedido = pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    mp_sdk.responder(123, referencia_de(session, pedido.id))
    post_webhook(client, "123")

    response = post_webhook(client, "123")

    assert response.json()["status"] == "already_processed"
    assert pagos_de(session, pedido.id)[0].estado == "a_devolver"


def test_el_router_solo_dispara_websocket_cuando_hay_pedido_actualizado(
    client: TestClient, session: Session, normal_user: dict, mp_sdk: MPFalso, monkeypatch: pytest.MonkeyPatch
) -> None:
    enviados: list[tuple[str, str]] = []

    async def send_to_room(room: str, evento: str, payload: dict) -> None:
        enviados.append((room, evento))

    monkeypatch.setattr("app.modules.pagos.router.manager.send_to_room", send_to_room)
    cancelado = pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    pendiente = pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_sdk.responder(1, referencia_de(session, cancelado.id))
    mp_sdk.responder(2, referencia_de(session, pendiente.id))

    post_webhook(client, "1")
    assert enviados == []

    post_webhook(client, "2")
    assert enviados == [("role:KDS", "PEDIDO_CONFIRMADO"), (f"pedido:{pendiente.id}", "PEDIDO_CONFIRMADO")]
