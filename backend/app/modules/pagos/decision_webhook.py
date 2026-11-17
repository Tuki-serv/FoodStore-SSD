"""Decisión pura de idempotencia del webhook de MercadoPago (sin I/O, testeable sin BD)."""
from enum import StrEnum

ESTADO_PENDIENTE = "pendiente"
ESTADO_RECHAZADO = "rechazado"
ESTADOS_TERMINALES = frozenset({"aprobado", "a_devolver"})


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
