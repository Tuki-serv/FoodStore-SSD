"""Transiciones de pedidos evaluadas con la UNIÓN de los roles del usuario (no con `roles[0]`)."""
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pedidos.models import Pedido
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


def _pedido(session: Session, usuario_id: int, estado: str) -> Pedido:
    pedido = Pedido(
        usuario_id=usuario_id,
        estado_codigo=estado,
        forma_pago_codigo="EFECTIVO",
        subtotal="1500.00",
        total="1500.00",
        costo_envio="0.00",
        descuento="0.00",
    )
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido


def _estado_en_bd(session: Session, pedido_id: int) -> str:
    session.expire_all()
    return session.get(Pedido, pedido_id).estado_codigo


def _actor(session: Session, roles: list[str]) -> tuple[int, dict[str, str]]:
    usuario = crear_usuario_con_roles(session, roles)
    return usuario.id, bearer_de_usuario(usuario, roles)


def _cambiar_estado(client: TestClient, headers: dict, pedido_id: int, destino: str, motivo: str | None = None):
    return client.patch(
        f"/api/v1/pedidos/{pedido_id}/estado", json={"nuevo_estado": destino, "motivo": motivo}, headers=headers
    )


def _cancelar_propio(client: TestClient, headers: dict, pedido_id: int, motivo: str = "me arrepentí"):
    return client.request("DELETE", f"/api/v1/pedidos/{pedido_id}", json={"motivo": motivo}, headers=headers)


def test_estado_stock_mas_pedidos_avanza_a_en_prep(client: TestClient, session: Session, normal_user: dict) -> None:
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["STOCK", "PEDIDOS"])

    response = _cambiar_estado(client, headers, pedido.id, "EN_PREP")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "EN_PREP"


def test_estado_client_mas_admin_avanza_a_en_prep(client: TestClient, session: Session, normal_user: dict) -> None:
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["CLIENT", "ADMIN"])

    response = _cambiar_estado(client, headers, pedido.id, "EN_PREP")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "EN_PREP"


def test_estado_solo_cocina_recibe_409_y_el_pedido_no_cambia(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["COCINA"])

    response = _cambiar_estado(client, headers, pedido.id, "EN_PREP")

    assert response.status_code == 409
    assert _estado_en_bd(session, pedido.id) == "CONFIRMADO"


def test_cancelar_propio_stock_mas_client_cancela_pedido_pendiente(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["STOCK", "CLIENT"])
    pedido = _pedido(session, usuario.id, "PENDIENTE")

    response = _cancelar_propio(client, bearer_de_usuario(usuario, ["STOCK", "CLIENT"]), pedido.id)

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "CANCELADO"


def test_cancelar_propio_solo_client_en_en_prep_recibe_409_y_no_cambia(client: TestClient, session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    pedido = _pedido(session, usuario.id, "EN_PREP")

    response = _cancelar_propio(client, bearer_de_usuario(usuario, ["CLIENT"]), pedido.id)

    assert response.status_code == 409
    assert _estado_en_bd(session, pedido.id) == "EN_PREP"


def test_cancelar_propio_client_mas_admin_en_en_prep_cancela_por_union_de_roles(
    client: TestClient, session: Session
) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT", "ADMIN"])
    pedido = _pedido(session, usuario.id, "EN_PREP")

    response = _cancelar_propio(client, bearer_de_usuario(usuario, ["CLIENT", "ADMIN"]), pedido.id)

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "CANCELADO"


def test_estado_pedidos_mas_client_cancela_pedido_ajeno_y_el_historial_registra_al_actor(
    client: TestClient, session: Session, normal_user: dict
) -> None:
    pedido = _pedido(session, normal_user["id"], "EN_PREP")
    actor_id, headers = _actor(session, ["PEDIDOS", "CLIENT"])

    response = _cambiar_estado(client, headers, pedido.id, "CANCELADO", motivo="sin stock de insumos")

    assert response.status_code == 200
    assert _estado_en_bd(session, pedido.id) == "CANCELADO"
    historial = session.exec(select(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == pedido.id)).all()
    assert [(h.estado_desde, h.estado_hacia, h.usuario_id) for h in historial] == [("EN_PREP", "CANCELADO", actor_id)]


def test_estado_solo_stock_recibe_403_y_no_llega_a_la_fsm(client: TestClient, session: Session, normal_user: dict) -> None:
    pedido = _pedido(session, normal_user["id"], "CONFIRMADO")
    _, headers = _actor(session, ["STOCK"])

    response = _cambiar_estado(client, headers, pedido.id, "EN_PREP")

    assert response.status_code == 403
    assert _estado_en_bd(session, pedido.id) == "CONFIRMADO"
