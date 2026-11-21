"""Decisiones puras del webhook de MercadoPago: mapeo de estados, control del monto e idempotencia (sin I/O, testeable sin BD)."""
from collections.abc import Mapping
from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

ESTADO_PENDIENTE = "pendiente"
ESTADO_RECHAZADO = "rechazado"
ESTADO_APROBADO = "aprobado"
ESTADO_A_DEVOLVER = "a_devolver"
ESTADOS_TERMINALES = frozenset({ESTADO_APROBADO, ESTADO_A_DEVOLVER})
_CENTAVO = Decimal("0.01")

# Estado local del pago según el `status` de la ORDEN de MercadoPago (D20 de C-12). `partially_refunded` es `aprobado`:
# el cobro existió y la parte devuelta la decide el comercio.
ESTADO_LOCAL_POR_ESTADO_ORDEN: Mapping[str, str] = {
    "processed": ESTADO_APROBADO,
    "partially_refunded": ESTADO_APROBADO,
    "failed": ESTADO_RECHAZADO,
    "canceled": ESTADO_RECHAZADO,
    "refunded": ESTADO_RECHAZADO,
    "charged_back": ESTADO_RECHAZADO,
    "created": ESTADO_PENDIENTE,
    "processing": ESTADO_PENDIENTE,
    "action_required": ESTADO_PENDIENTE,
}


def estado_local_para(estado_orden: str | None) -> str | None:
    """Estado local del pago para el `status` de la orden de MercadoPago; `None` si no tiene mapeo."""
    return ESTADO_LOCAL_POR_ESTADO_ORDEN.get(estado_orden) if estado_orden is not None else None


def monto_coincide(esperado: Decimal, informado: Decimal | None) -> bool:
    """¿El `total_amount` de la orden es, al centavo, el monto del intento local? Un monto ausente no coincide."""
    if informado is None:
        return False
    return esperado.quantize(_CENTAVO, rounding=ROUND_HALF_UP) == informado.quantize(_CENTAVO, rounding=ROUND_HALF_UP)


class Accion(StrEnum):
    PROCESAR = "processed"
    YA_PROCESADO = "already_processed"


def decidir_transicion_pago(
    estado_local: str,
    mp_order_id_local: str | None,
    mp_order_id: str | None,
    nuevo_estado: str,
) -> Accion:
    """Decide si una notificación de la orden `mp_order_id` con `nuevo_estado` modifica al pago local.

    `aprobado` y `a_devolver` son terminales; un `pendiente`/`rechazado` ya registrado con la misma orden y el mismo
    estado es una reentrega; cualquier otro caso (cambio de estado o nuevo intento con otra orden) se procesa.
    """
    if estado_local in ESTADOS_TERMINALES:
        return Accion.YA_PROCESADO
    if estado_local == nuevo_estado and mp_order_id is not None and mp_order_id_local == mp_order_id:
        return Accion.YA_PROCESADO
    return Accion.PROCESAR
