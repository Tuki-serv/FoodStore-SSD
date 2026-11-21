"""Borde de MercadoPago: traduce el SDK (Orders API, `/v1/orders`) a resultados y errores del dominio.

Es el único módulo que conoce el SDK y la forma JSON de Orders. Nunca registra ni incluye en un mensaje el token de la
tarjeta, el access token ni el cuerpo enviado.
"""
import logging
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

import mercadopago
from mercadopago.config import RequestOptions

logger = logging.getLogger(__name__)

_CENTAVO = Decimal("0.01")
_MAX_CAUSA = 100
_CLAVE_YA_USADA = "idempotency_key_already_used"


class PagoRechazadoPorMP(Exception):
    """MercadoPago respondió 4xx de datos a la creación: no creó ninguna orden (token inválido o usado, datos incorrectos)."""

    def __init__(self, causa: str) -> None:
        super().__init__("MercadoPago rechazó los datos del pago")
        self.causa = causa


class MercadoPagoNoDisponible(Exception):
    """MercadoPago no respondió o respondió 5xx/423: el resultado de la operación es desconocido (reintentable)."""


class CredencialesMPRechazadas(Exception):
    """MercadoPago respondió 401/403: el `MP_ACCESS_TOKEN` configurado no sirve (no es un problema de los datos del pago)."""

    def __init__(self, status: int, codigo: str) -> None:
        super().__init__("MercadoPago rechazó las credenciales configuradas (MP_ACCESS_TOKEN)")
        self.status = status
        self.codigo = codigo


@dataclass(frozen=True)
class DatosCobroMP:
    monto: Decimal
    token: str
    payment_method_id: str
    payment_type_id: str
    installments: int
    payer_email: str
    payer_identification: dict[str, str] | None
    descripcion: str
    external_reference: str


@dataclass(frozen=True)
class ResultadoMP:
    """`mp_status` es el estado de la orden; `mp_status_detail`, el de la transacción (o el de la orden si no hay)."""

    mp_order_id: str | None
    mp_payment_id: str | None
    mp_status: str | None
    mp_status_detail: str | None
    external_reference: str | None
    total_amount: Decimal | None = None  # monto de la orden según MercadoPago; `None` si falta o es ilegible


def _monto_texto(monto: Decimal) -> str:
    return str(monto.quantize(_CENTAVO, rounding=ROUND_HALF_UP))


def _monto_de_la_orden(orden: dict[str, Any]) -> Decimal | None:
    """`total_amount` de la orden (texto) como `Decimal`; ausente o inválido → `None`."""
    crudo = orden.get("total_amount")
    if crudo is None:
        return None
    try:
        monto = Decimal(str(crudo))
    except InvalidOperation:
        return None
    return monto if monto.is_finite() else None


def _a_resultado(orden: dict[str, Any]) -> ResultadoMP:
    transacciones = (orden.get("transactions") or {}).get("payments") or []
    transaccion = transacciones[0] if transacciones and isinstance(transacciones[0], dict) else {}
    return ResultadoMP(
        mp_order_id=orden.get("id"),
        mp_payment_id=transaccion.get("id"),
        mp_status=orden.get("status"),
        mp_status_detail=transaccion.get("status_detail") or orden.get("status_detail"),
        external_reference=orden.get("external_reference"),
        total_amount=_monto_de_la_orden(orden),
    )


def _orden_en(response: Any) -> dict[str, Any] | None:
    """La orden de una respuesta: en la raíz, o bajo `data` junto a `errors` (402 de la doc); `None` si no hay."""
    if not isinstance(response, dict):
        return None
    candidata = response.get("data") if isinstance(response.get("data"), dict) else response
    return candidata if candidata.get("id") is not None and candidata.get("status") is not None else None


def _codigo(response: Any) -> str:
    """Primer código de error de MercadoPago (sin eco del cuerpo enviado), acotado al ancho de la columna."""
    if isinstance(response, dict):
        errores = response.get("errors")
        if isinstance(errores, list) and errores and isinstance(errores[0], dict) and errores[0].get("code") is not None:
            return str(errores[0]["code"])[:_MAX_CAUSA]
        if response.get("message"):
            return str(response["message"])[:_MAX_CAUSA]
    return "unknown"


class PasarelaMercadoPago:
    def __init__(self, access_token: str) -> None:
        self._sdk = mercadopago.SDK(access_token)

    def crear_pago(self, datos: DatosCobroMP, idempotency_key: str) -> ResultadoMP:
        """Crea la orden con `X-Idempotency-Key`. Un cobro rechazado (402 `failed`) es un resultado, no una excepción."""
        monto = _monto_texto(datos.monto)
        payer: dict[str, Any] = {"email": datos.payer_email}
        if datos.payer_identification:
            payer["identification"] = datos.payer_identification
        cuerpo: dict[str, Any] = {
            "type": "online",
            "processing_mode": "automatic",
            "total_amount": monto,
            "external_reference": datos.external_reference,
            "description": datos.descripcion,
            "payer": payer,
            "transactions": {
                "payments": [
                    {
                        "amount": monto,
                        "payment_method": {
                            "id": datos.payment_method_id,
                            "type": datos.payment_type_id,
                            "token": datos.token,
                            "installments": datos.installments,
                        },
                    }
                ]
            },
        }
        opciones = RequestOptions(custom_headers={"x-idempotency-key": idempotency_key})
        respuesta = self._llamar("crear la orden", lambda: self._sdk.order().create(cuerpo, opciones))
        return self._traducir(respuesta, creacion=True, external_reference=datos.external_reference)

    def consultar_orden(self, order_id: str) -> ResultadoMP:
        respuesta = self._llamar("consultar la orden", lambda: self._sdk.order().get(order_id))
        return self._traducir(respuesta, creacion=False)

    def buscar_por_referencia(self, external_reference: str) -> ResultadoMP | None:
        """Orden con esa `external_reference` (reconciliación ante una clave de idempotencia ya usada), o `None`."""
        respuesta = self._llamar(
            "buscar la orden", lambda: self._sdk.order().search({"external_reference": external_reference})
        )
        self._exigir_ok(respuesta, "buscar la orden")
        response = respuesta.get("response")
        ordenes = response if isinstance(response, list) else (response or {}).get("data") or []
        for orden in ordenes:
            if isinstance(orden, dict) and orden.get("id") is not None:
                return _a_resultado(orden)
        return None

    # ─── Traducción de respuestas (un solo camino para crear y consultar) ──────────────────────────────────────
    @staticmethod
    def _llamar(accion: str, llamada) -> dict[str, Any]:
        try:
            return llamada()
        except (OSError, ValueError, mercadopago.MercadoPagoError) as exc:  # red, JSON ilegible o error tipado del SDK
            logger.warning("Error al %s en MercadoPago: %s", accion, type(exc).__name__)
            raise MercadoPagoNoDisponible(f"No se pudo {accion} en MercadoPago") from exc

    @staticmethod
    def _exigir_ok(respuesta: dict[str, Any], accion: str) -> None:
        status = respuesta.get("status")
        if status == 200:
            return
        if status in (401, 403):
            codigo = _codigo(respuesta.get("response"))
            logger.error("MercadoPago rechazó las credenciales al %s: status=%s code=%s", accion, status, codigo)
            raise CredencialesMPRechazadas(status, codigo)
        logger.warning("MercadoPago respondió %s al %s", status, accion)
        raise MercadoPagoNoDisponible(f"No se pudo {accion} en MercadoPago")

    def _traducir(
        self, respuesta: dict[str, Any], *, creacion: bool, external_reference: str | None = None
    ) -> ResultadoMP:
        status = respuesta.get("status")
        response = respuesta.get("response", {})
        if status in (200, 201):
            orden = _orden_en(response)
            if orden is not None:
                return _a_resultado(orden)
            logger.warning("MercadoPago respondió %s sin una orden reconocible", status)
            raise MercadoPagoNoDisponible("MercadoPago respondió sin una orden reconocible")
        if not creacion:
            self._exigir_ok(respuesta, "consultar la orden")
            raise MercadoPagoNoDisponible("No se pudo consultar la orden en MercadoPago")  # pragma: no cover
        if status == 402 and (orden := _orden_en(response)) is not None:  # cobro rechazado: la orden `failed` es el resultado
            return _a_resultado(orden)
        if status in (401, 403):
            self._exigir_ok(respuesta, "crear la orden")
        if status == 409 and _codigo(response) == _CLAVE_YA_USADA:
            existente = self.buscar_por_referencia(external_reference) if external_reference else None
            if existente is None:
                raise MercadoPagoNoDisponible("No se pudo recuperar la orden ya creada en MercadoPago")
            return existente
        if status == 423 or not isinstance(status, int) or not 400 <= status < 500:
            logger.warning("MercadoPago respondió %s al crear la orden", status)
            raise MercadoPagoNoDisponible("No se pudo crear la orden en MercadoPago")
        raise PagoRechazadoPorMP(_codigo(response))
