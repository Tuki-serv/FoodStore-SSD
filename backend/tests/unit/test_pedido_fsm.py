"""FSM pura del pedido (spec order-lifecycle): destinos permitidos por actor, estado y forma de pago. Sin base de datos."""
import pytest

from app.modules.pedidos.fsm import ACTOR_SISTEMA, Actor, destinos_permitidos, motivo_rechazo_confirmacion


def _usuario(*roles: str) -> Actor:
    return Actor.usuario(1, frozenset(roles))


def test_pedidos_en_en_prep_puede_despachar_o_cancelar() -> None:
    assert destinos_permitidos(_usuario("PEDIDOS"), "EN_PREP", "EFECTIVO") == frozenset({"EN_CAMINO", "CANCELADO"})


def test_pedidos_en_en_camino_solo_puede_entregar() -> None:
    assert destinos_permitidos(_usuario("PEDIDOS"), "EN_CAMINO", "EFECTIVO") == frozenset({"ENTREGADO"})


# ─── Secuencia y terminales ──────────────────────────────────────────────────
def test_admin_en_en_prep_no_puede_saltar_a_entregado() -> None:
    assert "ENTREGADO" not in destinos_permitidos(_usuario("ADMIN"), "EN_PREP", "EFECTIVO")


def test_admin_en_confirmado_puede_preparar_o_cancelar() -> None:
    assert destinos_permitidos(_usuario("ADMIN"), "CONFIRMADO", "EFECTIVO") == frozenset({"EN_PREP", "CANCELADO"})


def test_admin_en_en_camino_no_cancela_ni_retrocede() -> None:
    destinos = destinos_permitidos(_usuario("ADMIN"), "EN_CAMINO", "EFECTIVO")
    assert destinos == frozenset({"ENTREGADO"})
    assert "CANCELADO" not in destinos and "EN_PREP" not in destinos


@pytest.mark.parametrize("terminal", ["ENTREGADO", "CANCELADO"])
@pytest.mark.parametrize(
    "actor",
    [_usuario("ADMIN"), _usuario("PEDIDOS"), _usuario("CLIENT"), _usuario("ADMIN", "PEDIDOS"), ACTOR_SISTEMA],
)
def test_estados_terminales_no_tienen_destinos(actor: Actor, terminal: str) -> None:
    assert destinos_permitidos(actor, terminal, "MERCADOPAGO") == frozenset()


@pytest.mark.parametrize("estado", ["PENDIENTE", "CONFIRMADO"])
def test_client_solo_cancela_en_pendiente_y_confirmado(estado: str) -> None:
    assert destinos_permitidos(_usuario("CLIENT"), estado, "EFECTIVO") == frozenset({"CANCELADO"})


def test_client_en_en_prep_no_tiene_destinos() -> None:
    assert destinos_permitidos(_usuario("CLIENT"), "EN_PREP", "EFECTIVO") == frozenset()


@pytest.mark.parametrize("rol", ["COCINA", "STOCK"])
@pytest.mark.parametrize("estado", ["PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO", "CANCELADO"])
def test_roles_sin_transiciones_no_tienen_destinos(rol: str, estado: str) -> None:
    assert destinos_permitidos(_usuario(rol), estado, "EFECTIVO") == frozenset()


def test_stock_mas_pedidos_en_en_camino_entrega_por_union() -> None:
    assert destinos_permitidos(_usuario("STOCK", "PEDIDOS"), "EN_CAMINO", "EFECTIVO") == frozenset({"ENTREGADO"})


def test_client_mas_admin_en_en_prep_puede_cancelar() -> None:
    assert "CANCELADO" in destinos_permitidos(_usuario("CLIENT", "ADMIN"), "EN_PREP", "EFECTIVO")


# ─── Regla por forma de pago ─────────────────────────────────────────────────
@pytest.mark.parametrize("forma_pago", ["EFECTIVO", "TRANSFERENCIA"])
def test_admin_confirma_efectivo_y_transferencia(forma_pago: str) -> None:
    assert "CONFIRMADO" in destinos_permitidos(_usuario("ADMIN"), "PENDIENTE", forma_pago)


@pytest.mark.parametrize("forma_pago", ["MERCADOPAGO", "TARJETA"])
def test_admin_solo_cancela_mercadopago_y_tarjeta_en_pendiente(forma_pago: str) -> None:
    assert destinos_permitidos(_usuario("ADMIN"), "PENDIENTE", forma_pago) == frozenset({"CANCELADO"})


def test_sistema_confirma_o_cancela_mercadopago_en_pendiente() -> None:
    assert destinos_permitidos(ACTOR_SISTEMA, "PENDIENTE", "MERCADOPAGO") == frozenset({"CONFIRMADO", "CANCELADO"})


@pytest.mark.parametrize("forma_pago", ["EFECTIVO", "TRANSFERENCIA", "TARJETA"])
def test_sistema_no_confirma_ni_cancela_pedidos_que_no_son_mercadopago(forma_pago: str) -> None:
    assert destinos_permitidos(ACTOR_SISTEMA, "PENDIENTE", forma_pago) == frozenset()


def test_sistema_no_tiene_destinos_desde_confirmado() -> None:
    assert destinos_permitidos(ACTOR_SISTEMA, "CONFIRMADO", "MERCADOPAGO") == frozenset()


def test_client_mas_pedidos_confirma_efectivo() -> None:
    assert "CONFIRMADO" in destinos_permitidos(_usuario("CLIENT", "PEDIDOS"), "PENDIENTE", "EFECTIVO")


def test_pedidos_mas_admin_no_confirma_mercadopago() -> None:
    assert "CONFIRMADO" not in destinos_permitidos(_usuario("PEDIDOS", "ADMIN"), "PENDIENTE", "MERCADOPAGO")


# ─── Actor y mensaje ─────────────────────────────────────────────────────────
def test_actor_usuario_descarta_el_pseudo_rol_sistema() -> None:
    actor = Actor.usuario(5, frozenset({"SISTEMA", "CLIENT"}))

    assert actor.roles == frozenset({"CLIENT"})
    assert "CONFIRMADO" not in destinos_permitidos(actor, "PENDIENTE", "MERCADOPAGO")


def test_actor_sistema_no_tiene_usuario() -> None:
    assert ACTOR_SISTEMA.usuario_id is None


def test_motivo_rechazo_de_confirmar_mercadopago_a_mano_indica_pago_aprobado() -> None:
    assert (
        motivo_rechazo_confirmacion(_usuario("ADMIN"), "MERCADOPAGO")
        == "Un pedido MERCADOPAGO se confirma con el pago aprobado"
    )


def test_motivo_rechazo_de_confirmar_efectivo_es_ninguno() -> None:
    assert motivo_rechazo_confirmacion(_usuario("ADMIN"), "EFECTIVO") is None
