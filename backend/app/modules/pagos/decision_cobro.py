"""Decisión pura de cobro: qué hacer con un nuevo intento de pago de un pedido (sin I/O, testeable sin BD)."""
from collections.abc import Sequence
from enum import StrEnum
from typing import Protocol

FORMA_PAGO_MERCADOPAGO = "MERCADOPAGO"
ESTADO_PEDIDO_PENDIENTE = "PENDIENTE"
_ESTADOS_QUE_BLOQUEAN = frozenset({"aprobado", "a_devolver"})


class PagoDelPedido(Protocol):
    """Lo único que la decisión lee de un pago."""

    estado: str
    mp_payment_id: int | None


class Intento(StrEnum):
    CREAR = "crear"  # intento nuevo con claves nuevas
    REUTILIZAR = "reutilizar"  # el último intento quedó con resultado desconocido: mismas claves
    NO_PERMITIDO = "no_permitido"


def decidir_intento(forma_pago: str, estado_pedido: str, pagos: Sequence[PagoDelPedido]) -> Intento:
    """Decide qué hacer con un `POST /pagos/crear`. `pagos` va del más reciente al más antiguo."""
    if forma_pago != FORMA_PAGO_MERCADOPAGO or estado_pedido != ESTADO_PEDIDO_PENDIENTE:
        return Intento.NO_PERMITIDO
    if any(pago.estado in _ESTADOS_QUE_BLOQUEAN for pago in pagos):
        return Intento.NO_PERMITIDO
    if not pagos:
        return Intento.CREAR
    ultimo = pagos[0]
    if ultimo.estado == "pendiente":
        # Con id de MercadoPago el pago está en proceso allá; sin id no se sabe si se creó: se reintenta con su clave.
        return Intento.NO_PERMITIDO if ultimo.mp_payment_id is not None else Intento.REUTILIZAR
    return Intento.CREAR
