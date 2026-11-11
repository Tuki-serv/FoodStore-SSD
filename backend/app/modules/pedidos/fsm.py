"""Máquina de estados del pedido: dominio puro (spec `order-lifecycle`, C-09).

Define, de forma declarativa, qué destinos puede pedir cada actor desde cada estado y qué actores pueden confirmar
según la forma de pago. No conoce SQLModel, FastAPI ni repositorios: el service la consulta y aplica el resultado.
"""
from collections.abc import Mapping
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from types import MappingProxyType

from app.core.permissions import tiene_algun_rol, union_por_roles

# ─── Estados y roles (códigos del catálogo) ──────────────────────────────────
PENDIENTE = "PENDIENTE"
CONFIRMADO = "CONFIRMADO"
EN_PREP = "EN_PREP"
EN_CAMINO = "EN_CAMINO"
ENTREGADO = "ENTREGADO"
CANCELADO = "CANCELADO"

ADMIN = "ADMIN"
PEDIDOS = "PEDIDOS"
CLIENT = "CLIENT"
SISTEMA = "SISTEMA"  # pseudo-rol: no existe en el catálogo de roles; solo lo usa ACTOR_SISTEMA

EFECTIVO = "EFECTIVO"
TRANSFERENCIA = "TRANSFERENCIA"
MERCADOPAGO = "MERCADOPAGO"

MOTIVO_MERCADOPAGO_SE_CONFIRMA_CON_PAGO = "Un pedido MERCADOPAGO se confirma con el pago aprobado"

_GESTION: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        PENDIENTE: frozenset({CONFIRMADO, CANCELADO}),
        CONFIRMADO: frozenset({EN_PREP, CANCELADO}),
        EN_PREP: frozenset({EN_CAMINO, CANCELADO}),
        EN_CAMINO: frozenset({ENTREGADO}),
        ENTREGADO: frozenset(),
        CANCELADO: frozenset(),
    }
)

# Transiciones por rol/actor. Un rol ausente (STOCK, COCINA) no aporta nada; ENTREGADO y CANCELADO son terminales.
TRANSICIONES: Mapping[str, Mapping[str, frozenset[str]]] = MappingProxyType(
    {
        ADMIN: _GESTION,
        PEDIDOS: _GESTION,
        CLIENT: MappingProxyType(
            {PENDIENTE: frozenset({CANCELADO}), CONFIRMADO: frozenset({CANCELADO})}
        ),
        SISTEMA: MappingProxyType({PENDIENTE: frozenset({CONFIRMADO})}),
    }
)

# Quién puede confirmar un pedido según su forma de pago; una forma ausente (TARJETA) no la confirma nadie.
CONFIRMAN_POR_FORMA_PAGO: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        EFECTIVO: frozenset({ADMIN, PEDIDOS}),
        TRANSFERENCIA: frozenset({ADMIN, PEDIDOS}),
        MERCADOPAGO: frozenset({SISTEMA}),
    }
)


@dataclass(frozen=True)
class Actor:
    """Quien pide la transición: un usuario con sus roles, o el Sistema (`usuario_id` nulo)."""

    usuario_id: int | None
    roles: frozenset[str]

    @classmethod
    def usuario(cls, usuario_id: int, roles: AbstractSet[str]) -> "Actor":
        """Actor humano; descarta el pseudo-rol SISTEMA para que ningún usuario pueda hacerse pasar por él."""
        return cls(usuario_id, frozenset(roles) - {SISTEMA})


ACTOR_SISTEMA = Actor(None, frozenset({SISTEMA}))


def _puede_confirmar(actor: Actor, forma_pago: str) -> bool:
    return tiene_algun_rol(actor.roles, CONFIRMAN_POR_FORMA_PAGO.get(forma_pago, frozenset()))


def destinos_permitidos(actor: Actor, estado_actual: str, forma_pago: str) -> frozenset[str]:
    """Destinos que `actor` puede pedir desde `estado_actual` para un pedido de `forma_pago` (unión por roles)."""
    destinos = union_por_roles(TRANSICIONES, actor.roles, estado_actual)
    if CONFIRMADO in destinos and not _puede_confirmar(actor, forma_pago):
        destinos = destinos - {CONFIRMADO}
    return destinos


def motivo_rechazo_confirmacion(actor: Actor, forma_pago: str) -> str | None:
    """Mensaje específico del 409 si confirmar a mano un pedido MERCADOPAGO; `None` si no aplica uno propio."""
    if forma_pago == MERCADOPAGO and not _puede_confirmar(actor, forma_pago):
        return MOTIVO_MERCADOPAGO_SE_CONFIRMA_CON_PAGO
    return None
