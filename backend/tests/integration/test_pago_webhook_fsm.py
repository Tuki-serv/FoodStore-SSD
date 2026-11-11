"""Webhook de pagos y FSM del pedido: la confirmación automática la hace el Sistema (usuario_id nulo)."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pagos.models import Pago
from app.modules.pedidos.models import Pedido
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


class _PagoAprobadoSDK:
    """Doble del borde externo (SDK de MercadoPago): `payment().get` devuelve un pago aprobado del pedido `ref`."""

    referencia: str = ""

    def __init__(self, access_token: str) -> None:
        pass

    def payment(self) -> "_PagoAprobadoSDK":
        return self

    def get(self, payment_id: int) -> dict:
        return {
            "status": 200,
            "response": {"id": payment_id, "status": "approved", "external_reference": type(self).referencia},
        }


@pytest.fixture(name="mp_aprobado")
def mp_aprobado_fixture(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "TEST-token")
    monkeypatch.setattr("app.modules.pagos.service.mercadopago.SDK", _PagoAprobadoSDK)

    def _apuntar_a(pedido_id: int) -> None:
        _PagoAprobadoSDK.referencia = str(pedido_id)

    return _apuntar_a


def _pedido_con_pago(session: Session, usuario_id: int, estado: str, forma_pago: str) -> Pedido:
    pedido = Pedido(
        usuario_id=usuario_id,
        estado_codigo=estado,
        forma_pago_codigo=forma_pago,
        subtotal="1500.00",
        total="1500.00",
        costo_envio="0.00",
        descuento="0.00",
    )
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    session.add(Pago(pedido_id=pedido.id, transaction_amount="1500.00", idempotency_key=str(uuid4())))
    session.commit()
    return pedido


def _historial(session: Session, pedido_id: int) -> list[HistorialEstadoPedido]:
    session.expire_all()
    return list(
        session.exec(
            select(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == pedido_id).order_by(HistorialEstadoPedido.id)
        ).all()
    )


def _webhook(client: TestClient):
    return client.post("/api/v1/pagos/webhook", json={"type": "payment", "data": {"id": "123"}})


def _estado(session: Session, pedido_id: int) -> str:
    session.expire_all()
    return session.get(Pedido, pedido_id).estado_codigo


def test_pago_aprobado_confirma_un_pedido_mercadopago_como_sistema(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "CONFIRMADO"
    ultima = _historial(session, pedido.id)[-1]
    assert (ultima.estado_desde, ultima.estado_hacia, ultima.usuario_id) == ("PENDIENTE", "CONFIRMADO", None)


def test_pago_aprobado_de_un_pedido_efectivo_no_lo_confirma(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "PENDIENTE"
    assert _historial(session, pedido.id) == []


def test_pago_aprobado_de_un_pedido_cancelado_lo_deja_cancelado(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    pedido = _pedido_con_pago(session, normal_user["id"], "CANCELADO", "MERCADOPAGO")
    mp_aprobado(pedido.id)

    response = _webhook(client)

    assert response.status_code == 200
    assert _estado(session, pedido.id) == "CANCELADO"
    assert _historial(session, pedido.id) == []


def test_confirmacion_manual_y_automatica_registran_una_fila_y_solo_difiere_el_actor(
    client: TestClient, session: Session, normal_user: dict, mp_aprobado
) -> None:
    manual = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    automatico = _pedido_con_pago(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    pedidos = crear_usuario_con_roles(session, ["PEDIDOS"])
    mp_aprobado(automatico.id)

    resp_manual = client.patch(
        f"/api/v1/pedidos/{manual.id}/estado",
        json={"estado_hacia": "CONFIRMADO"},
        headers=bearer_de_usuario(pedidos, ["PEDIDOS"]),
    )
    resp_auto = _webhook(client)

    assert resp_manual.status_code == 200 and resp_auto.status_code == 200
    fila_manual, fila_auto = _historial(session, manual.id), _historial(session, automatico.id)
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in fila_manual] == [
        ("PENDIENTE", "CONFIRMADO", pedidos.id)
    ]
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in fila_auto] == [("PENDIENTE", "CONFIRMADO", None)]
