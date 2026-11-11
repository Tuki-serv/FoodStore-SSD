"""Borde de MercadoPago: traduce el SDK (`/v1/payments`) a resultados y errores del dominio.

Es el único módulo que conoce el SDK. Nunca registra ni incluye en un mensaje el token de la tarjeta ni el access token.
"""
import logging
import warnings
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import mercadopago
from mercadopago.config import RequestOptions

logger = logging.getLogger(__name__)

_CENTAVO = Decimal("0.01")
_MAX_CAUSA = 100


class PagoRechazadoPorMP(Exception):
    """MercadoPago respondió 4xx a la creación: no creó ningún pago (token inválido o usado, datos incorrectos)."""

    def __init__(self, causa: str) -> None:
        super().__init__("MercadoPago rechazó los datos del pago")
        self.causa = causa


class MercadoPagoNoDisponible(Exception):
    """MercadoPago no respondió o respondió 5xx: el resultado de la operación es desconocido (reintentable)."""


@dataclass(frozen=True)
class DatosCobroMP:
    monto: Decimal
    token: str
    payment_method_id: str
    installments: int
    issuer_id: int | None
    payer_email: str
    payer_identification: dict[str, str] | None
    descripcion: str
    external_reference: str
    notification_url: str


@dataclass(frozen=True)
class ResultadoMP:
    mp_payment_id: int | None
    mp_status: str | None
    mp_status_detail: str | None
    mp_merchant_order_id: int | None
    external_reference: str | None


def _a_resultado(response: dict[str, Any]) -> ResultadoMP:
    order = response.get("order")
    merchant_order_id = order.get("id") if isinstance(order, dict) else response.get("merchant_order_id")
    return ResultadoMP(
        mp_payment_id=response.get("id"),
        mp_status=response.get("status"),
        mp_status_detail=response.get("status_detail"),
        mp_merchant_order_id=merchant_order_id,
        external_reference=response.get("external_reference"),
    )


def _causa(response: Any) -> str:
    """Código de causa del error de MercadoPago (sin eco del cuerpo enviado), acotado al ancho de la columna."""
    if isinstance(response, dict):
        causas = response.get("cause")
        if isinstance(causas, list) and causas and isinstance(causas[0], dict) and causas[0].get("code") is not None:
            return str(causas[0]["code"])[:_MAX_CAUSA]
        if response.get("message"):
            return str(response["message"])[:_MAX_CAUSA]
    return "unknown"[:_MAX_CAUSA]


class PasarelaMercadoPago:
    def __init__(self, access_token: str) -> None:
        self._sdk = mercadopago.SDK(access_token)

    def crear_pago(self, datos: DatosCobroMP, idempotency_key: str) -> ResultadoMP:
        """Crea el pago con `X-Idempotency-Key`: repetir la clave devuelve el pago original en vez de cobrar de nuevo."""
        monto = float(datos.monto.quantize(_CENTAVO, rounding=ROUND_HALF_UP))  # el SDK serializa con json: sin Decimal
        payer: dict[str, Any] = {"email": datos.payer_email}
        if datos.payer_identification:
            payer["identification"] = datos.payer_identification
        cuerpo: dict[str, Any] = {
            "transaction_amount": monto,
            "token": datos.token,
            "description": datos.descripcion,
            "installments": datos.installments,
            "payment_method_id": datos.payment_method_id,
            "payer": payer,
            "external_reference": datos.external_reference,
            "notification_url": datos.notification_url,
        }
        if datos.issuer_id is not None:
            cuerpo["issuer_id"] = datos.issuer_id
        opciones = RequestOptions(custom_headers={"x-idempotency-key": idempotency_key})

        try:
            with warnings.catch_warnings():  # el SDK desaconseja `notification_url` por pago; se usa a propósito (design D10)
                warnings.simplefilter("ignore", DeprecationWarning)
                resultado = self._sdk.payment().create(cuerpo, opciones)
        except (OSError, ValueError, mercadopago.MercadoPagoError) as exc:  # red, JSON ilegible o error tipado del SDK
            logger.warning("Error al crear el pago en MercadoPago: %s", type(exc).__name__)
            raise MercadoPagoNoDisponible("No se pudo crear el pago en MercadoPago") from exc

        status = resultado.get("status")
        response = resultado.get("response", {})
        if status in (200, 201):
            return _a_resultado(response)
        if isinstance(status, int) and 400 <= status < 500:
            raise PagoRechazadoPorMP(_causa(response))
        logger.warning("MercadoPago respondió %s al crear el pago", status)
        raise MercadoPagoNoDisponible("No se pudo crear el pago en MercadoPago")

    def consultar_pago(self, payment_id: int) -> ResultadoMP:
        try:
            resultado = self._sdk.payment().get(payment_id)
        except (OSError, ValueError, mercadopago.MercadoPagoError) as exc:
            logger.warning("Error al consultar el pago %s en MercadoPago: %s", payment_id, type(exc).__name__)
            raise MercadoPagoNoDisponible("No se pudo consultar el pago en MercadoPago") from exc
        if resultado.get("status") != 200:
            logger.warning("MercadoPago respondió %s al consultar el pago %s", resultado.get("status"), payment_id)
            raise MercadoPagoNoDisponible("No se pudo consultar el pago en MercadoPago")
        return _a_resultado(resultado.get("response", {}))
