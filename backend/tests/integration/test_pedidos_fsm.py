"""FSM del pedido por HTTP (spec order-lifecycle): secuencia, confirmación por forma de pago, cancelación e historial."""
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.modules.formas_pago.models import FormaPago
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pedidos.models import Pedido
from app.modules.pedidos.router import get_pedido_service
from app.modules.pedidos.service import PedidoService
from app.modules.pedidos.unit_of_work import PedidoUnitOfWork
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


def _pedido(session: Session, usuario_id: int, estado: str, forma_pago: str = "EFECTIVO") -> Pedido:
    if session.get(FormaPago, forma_pago) is None:  # TARJETA: forma heredada, ya no está en el catálogo del seed
        session.add(FormaPago(codigo=forma_pago, descripcion=forma_pago, habilitado=False))
        session.flush()
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
    return pedido


def _historial(session: Session, pedido_id: int) -> list[HistorialEstadoPedido]:
    session.expire_all()
    return list(
        session.exec(
            select(HistorialEstadoPedido)
            .where(HistorialEstadoPedido.pedido_id == pedido_id)
            .order_by(HistorialEstadoPedido.id)
        ).all()
    )


def _estado_en_bd(session: Session, pedido_id: int) -> str:
    session.expire_all()
    return session.get(Pedido, pedido_id).estado_codigo


def _actor(session: Session, roles: list[str]) -> tuple[int, dict[str, str]]:
    usuario = crear_usuario_con_roles(session, roles)
    return usuario.id, bearer_de_usuario(usuario, roles)


def _estado(client: TestClient, headers: dict, pedido_id: int, destino: str, motivo: str | None = None):
    return client.patch(
        f"/api/v1/pedidos/{pedido_id}/estado", json={"estado_hacia": destino, "motivo": motivo}, headers=headers
    )


def _cancelar_propio(client: TestClient, headers: dict, pedido_id: int, motivo: str = "me arrepentí"):
    return client.patch(
        f"/api/v1/pedidos/mis-pedidos/{pedido_id}/cancelar",
        json={"estado_hacia": "CANCELADO", "motivo": motivo},
        headers=headers,
    )


# ─── Secuencia de seis estados ───────────────────────────────────────────────
def test_pedidos_despacha_un_pedido_en_preparacion_y_registra_el_historial(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "EN_PREP")
    actor_id, headers = _actor(session, ["PEDIDOS"])

    response = _estado(client, headers, pedido.id, "EN_CAMINO")

    assert response.status_code == 200
    assert response.json()["estado_codigo"] == "EN_CAMINO"
    assert _estado_en_bd(session, pedido.id) == "EN_CAMINO"
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in _historial(session, pedido.id)] == [
        ("EN_PREP", "EN_CAMINO", actor_id)
    ]


def test_admin_entrega_un_pedido_en_camino(client: TestClient, session: Session, normal_user: dict) -> None:
    pedido = _pedido(session, normal_user["id"], "EN_CAMINO")
    _, headers = _actor(session, ["ADMIN"])

    response = _estado(client, headers, pedido.id, "ENTREGADO")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "ENTREGADO"


def test_stock_mas_pedidos_entrega_por_la_union_de_roles(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "EN_CAMINO")
    _, headers = _actor(session, ["STOCK", "PEDIDOS"])

    response = _estado(client, headers, pedido.id, "ENTREGADO")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "ENTREGADO"


@pytest.mark.parametrize(
    ("roles", "origen", "destino", "motivo", "status"),
    [
        (["ADMIN"], "EN_PREP", "ENTREGADO", None, 409),  # sin atajo
        (["PEDIDOS"], "CONFIRMADO", "EN_CAMINO", None, 409),  # sin saltos
        (["ADMIN"], "EN_CAMINO", "EN_PREP", None, 409),  # sin retrocesos
        (["ADMIN"], "EN_PREP", "DESPACHADO", None, 400),  # destino inexistente
        (["ADMIN"], "ENTREGADO", "CANCELADO", "x", 409),  # terminal
        (["PEDIDOS"], "CANCELADO", "CONFIRMADO", None, 409),  # terminal
        (["COCINA"], "EN_PREP", "EN_CAMINO", None, 409),  # rol sin transiciones
        (["CLIENT"], "EN_PREP", "EN_CAMINO", None, 403),  # fuera del endpoint de gestión
        (["ADMIN"], "EN_CAMINO", "CANCELADO", "no llegó", 409),  # nadie cancela en camino
    ],
)
def test_transiciones_rechazadas_no_cambian_el_pedido_ni_el_historial(
    client: TestClient,
    session: Session,
    normal_user: dict,
    roles: list[str],
    origen: str,
    destino: str,
    motivo: str | None,
    status: int,
) -> None:
    pedido = _pedido(session, normal_user["id"], origen)
    _, headers = _actor(session, roles)
    filas_antes = len(_historial(session, pedido.id))

    response = _estado(client, headers, pedido.id, destino, motivo)

    assert response.status_code == status
    assert _estado_en_bd(session, pedido.id) == origen
    assert len(_historial(session, pedido.id)) == filas_antes


# ─── Confirmación manual según forma de pago ─────────────────────────────────
def test_admin_no_confirma_a_mano_un_pedido_mercadopago(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "PENDIENTE", "MERCADOPAGO")
    _, headers = _actor(session, ["ADMIN"])

    response = _estado(client, headers, pedido.id, "CONFIRMADO")

    assert response.status_code == 409
    assert response.json()["detail"] == "Un pedido MERCADOPAGO se confirma con el pago aprobado"
    assert _estado_en_bd(session, pedido.id) == "PENDIENTE"
    assert _historial(session, pedido.id) == []


@pytest.mark.parametrize(
    ("roles", "forma_pago", "status", "estado_final"),
    [
        (["PEDIDOS"], "EFECTIVO", 200, "CONFIRMADO"),
        (["ADMIN"], "TRANSFERENCIA", 200, "CONFIRMADO"),
        (["CLIENT", "PEDIDOS"], "EFECTIVO", 200, "CONFIRMADO"),
        (["ADMIN"], "TARJETA", 409, "PENDIENTE"),
        (["COCINA"], "EFECTIVO", 409, "PENDIENTE"),
        (["PEDIDOS", "ADMIN"], "MERCADOPAGO", 409, "PENDIENTE"),
    ],
)
def test_confirmacion_manual_segun_forma_de_pago_y_roles(
    client: TestClient,
    session: Session,
    normal_user: dict,
    roles: list[str],
    forma_pago: str,
    status: int,
    estado_final: str,
) -> None:
    pedido = _pedido(session, normal_user["id"], "PENDIENTE", forma_pago)
    _, headers = _actor(session, roles)

    response = _estado(client, headers, pedido.id, "CONFIRMADO")

    assert response.status_code == status
    assert _estado_en_bd(session, pedido.id) == estado_final


# ─── Paso de confirmación inyectable (punto único de entrada a CONFIRMADO) ───
@pytest.fixture(name="override_service")
def override_service_fixture() -> Iterator[None]:
    yield
    app.dependency_overrides.pop(get_pedido_service, None)


def _usar_paso_de_confirmacion(session: Session, paso) -> None:
    app.dependency_overrides[get_pedido_service] = lambda: PedidoService(PedidoUnitOfWork(session), al_confirmar=paso)


def test_falla_en_el_paso_de_confirmacion_deja_el_pedido_pendiente_sin_historial(
    client: TestClient, session: Session, normal_user: dict, override_service: None
) -> None:
    def paso_que_falla(uow: PedidoUnitOfWork, pedido: Pedido) -> None:
        raise RuntimeError("falla simulada")

    pedido = _pedido(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    _, headers = _actor(session, ["ADMIN"])
    _usar_paso_de_confirmacion(session, paso_que_falla)

    with pytest.raises(RuntimeError):
        _estado(client, headers, pedido.id, "CONFIRMADO")

    assert _estado_en_bd(session, pedido.id) == "PENDIENTE"
    assert [h for h in _historial(session, pedido.id) if h.estado_hacia == "CONFIRMADO"] == []


def test_el_paso_de_confirmacion_se_invoca_una_vez_solo_al_confirmar(
    client: TestClient, session: Session, normal_user: dict, override_service: None
) -> None:
    llamadas: list[int] = []

    def paso_registrador(uow: PedidoUnitOfWork, pedido: Pedido) -> None:
        llamadas.append(pedido.id)

    pendiente = _pedido(session, normal_user["id"], "PENDIENTE", "EFECTIVO")
    confirmado = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["ADMIN"])
    _usar_paso_de_confirmacion(session, paso_registrador)

    assert _estado(client, headers, pendiente.id, "CONFIRMADO").status_code == 200
    assert llamadas == [pendiente.id]
    assert _estado(client, headers, confirmado.id, "EN_PREP").status_code == 200
    assert _estado(client, headers, confirmado.id, "CANCELADO", "x").status_code == 200  # ADMIN cancela en EN_PREP
    assert llamadas == [pendiente.id]


def test_cancelar_no_invoca_el_paso_de_confirmacion(
    client: TestClient, session: Session, normal_user: dict, override_service: None
) -> None:
    llamadas: list[int] = []
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["ADMIN"])
    _usar_paso_de_confirmacion(session, lambda uow, p: llamadas.append(p.id))

    response = _estado(client, headers, pedido.id, "CANCELADO", "x")

    assert response.status_code == 200
    assert llamadas == []


# ─── Cancelación con motivo ──────────────────────────────────────────────────
def test_cliente_cancela_su_pedido_confirmado(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    pedido = _pedido(session, usuario.id, "CONFIRMADO")

    response = _cancelar_propio(client, bearer_de_usuario(usuario, ["CLIENT"]), pedido.id, "me arrepentí")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "CANCELADO"


def test_cliente_solo_client_no_cancela_en_preparacion(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    pedido = _pedido(session, usuario.id, "EN_PREP")

    response = _cancelar_propio(client, bearer_de_usuario(usuario, ["CLIENT"]), pedido.id)

    assert response.status_code == 409
    assert _estado_en_bd(session, pedido.id) == "EN_PREP"


def test_pedidos_cancela_en_preparacion_y_el_historial_guarda_motivo_y_actor(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "EN_PREP")
    actor_id, headers = _actor(session, ["PEDIDOS"])

    response = _estado(client, headers, pedido.id, "CANCELADO", "sin insumos")

    assert response.status_code == 200
    ultima = _historial(session, pedido.id)[-1]
    assert (ultima.estado_desde, ultima.estado_hacia, ultima.motivo, ultima.usuario_id) == (
        "EN_PREP",
        "CANCELADO",
        "sin insumos",
        actor_id,
    )


def test_cancelar_sin_motivo_recibe_422_y_no_cambia(client: TestClient, session: Session, normal_user: dict) -> None:
    pedido = _pedido(session, normal_user["id"], "PENDIENTE")
    _, headers = _actor(session, ["ADMIN"])

    response = _estado(client, headers, pedido.id, "CANCELADO")

    assert response.status_code == 422
    assert _estado_en_bd(session, pedido.id) == "PENDIENTE"


def test_admin_cancela_confirmado_y_el_historial_registra_motivo_y_actor(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    actor_id, headers = _actor(session, ["ADMIN"])

    response = _estado(client, headers, pedido.id, "CANCELADO", "cliente no responde")

    assert response.status_code == 200
    ultima = _historial(session, pedido.id)[-1]
    assert (ultima.estado_desde, ultima.estado_hacia, ultima.motivo, ultima.usuario_id) == (
        "CONFIRMADO",
        "CANCELADO",
        "cliente no responde",
        actor_id,
    )
