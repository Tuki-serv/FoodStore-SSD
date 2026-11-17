"""Borde de MercadoPago para tests: doble del SDK (Orders API) y envío de notificaciones `order` firmadas.

La firma NO se mockea: `post_webhook` firma con `tests.support.mp_firma.firmar` (HMAC real).
"""
from fastapi.testclient import TestClient

from tests.support.mp_firma import firmar

SECRETO = "secreto-de-prueba"  # valor literal de test: nunca el del `.env`
TS = "1700000000000"


class CreacionRegistrada:
    """Una llamada a `order().create(...)`: cuerpo enviado y header `x-idempotency-key`."""

    def __init__(self, cuerpo: dict, headers: dict) -> None:
        self.cuerpo = cuerpo
        self.headers = headers

    @property
    def idempotency_key(self) -> str | None:
        return self.headers.get("x-idempotency-key")


def construir_orden(
    status: str = "processed",
    status_detail: str | None = "accredited",
    detalle_transaccion: str | None = "accredited",
    order_id: str = "ORD01X",
    payment_id: str | None = "PAY01X",
    external_reference: str | None = None,
) -> dict:
    """Cuerpo de una orden de la Orders API: estado/detalle de la orden y una transacción de pago (si hay `payment_id`)."""
    orden: dict = {"id": order_id, "status": status, "status_detail": status_detail, "external_reference": external_reference}
    if payment_id is not None:
        orden["transactions"] = {"payments": [{"id": payment_id, "status": status, "status_detail": detalle_transaccion}]}
    return orden


class _OrdenesFalsas:
    """`sdk.order()`: `create`, `get` y `search` de la Orders API sobre el estado del `MPFalso` que lo creó."""

    def __init__(self, mp: "MPFalso") -> None:
        self._mp = mp

    def create(self, datos: dict, request_options=None) -> dict:
        mp = self._mp
        headers = dict(request_options.custom_headers or {}) if request_options is not None else {}
        creacion = CreacionRegistrada(datos, headers)
        mp.creaciones.append(creacion)
        if mp._antes_de_responder is not None:
            mp._antes_de_responder(creacion)
        indice = min(len(mp.creaciones), len(mp._ordenes_a_crear)) - 1
        if indice < 0:
            raise AssertionError("MPFalso.order().create sin respuesta configurada (usar responder_orden)")
        configurada = mp._ordenes_a_crear[indice]
        if isinstance(configurada, BaseException):
            raise configurada
        if configurada["response"].get("id") is not None and configurada["response"].get("external_reference") is None:
            # MercadoPago devuelve la `external_reference` enviada
            return {**configurada, "response": {**configurada["response"], "external_reference": datos.get("external_reference")}}
        return configurada

    def get(self, order_id: str, request_options=None) -> dict:
        self._mp.llamadas.append(order_id)
        return self._mp._ordenes_por_id.get(order_id, {"status": 404, "response": {"errors": [{"code": "order_not_found"}]}})

    def search(self, filters: dict | None = None, request_options=None) -> dict:
        self._mp.busquedas.append(dict(filters or {}))
        return {"status": 200, "response": {"data": list(self._mp._resultado_busqueda)}}


class MPFalso:
    """Doble de `mercadopago.SDK`.

    Orders API (`order()`): `create`/`get`/`search`, configurados con `responder_orden`, `responder_orden_error`,
    `responder_consulta_error`, `responder_busqueda` y `fallar_creacion`; las llamadas quedan en `creaciones`, `llamadas`
    (ids de orden consultados) y `busquedas` (filtros).
    """

    def __init__(self) -> None:
        self.llamadas: list[str] = []
        self.creaciones: list[CreacionRegistrada] = []
        self.tokens: list[str] = []
        self._antes_de_responder = None
        self.busquedas: list[dict] = []
        self._ordenes_a_crear: list[dict | BaseException] = []
        self._ordenes_por_id: dict[str, dict] = {}
        self._resultado_busqueda: list[dict] = []

    # ── Orders API ──────────────────────────────────────────────────────────
    def order(self) -> _OrdenesFalsas:
        return _OrdenesFalsas(self)

    def responder_orden(
        self,
        status_http: int = 201,
        status: str = "processed",
        status_detail: str | None = "accredited",
        detalle_transaccion: str | None = "accredited",
        order_id: str = "ORD01X",
        payment_id: str | None = "PAY01X",
        external_reference: str | None = None,
        envuelta_en_data: bool = False,
        solo_consulta: bool = False,
    ) -> None:
        """Encola la respuesta de la próxima creación (la última se repite) y la deja consultable con `get(order_id)`.

        `envuelta_en_data` entrega `{errors, data: orden}` (forma del 402 de la doc); `solo_consulta` no encola creación.
        """
        orden = construir_orden(status, status_detail, detalle_transaccion, order_id, payment_id, external_reference)
        cuerpo = {"errors": [{"code": detalle_transaccion or "failed", "message": "x"}], "data": orden} if envuelta_en_data else orden
        if not solo_consulta:
            self._ordenes_a_crear.append({"status": status_http, "response": cuerpo})
        self._ordenes_por_id[order_id] = {"status": 200, "response": orden}

    def responder_consulta(
        self, order_id: str, referencia: str | None, status: str = "processed", detalle_transaccion: str | None = None
    ) -> None:
        """Deja consultable `get(order_id)` con ese estado de orden y `external_reference` (sin encolar creaciones)."""
        self.responder_orden(
            201,
            status,
            status,
            detalle_transaccion or status,
            order_id=order_id,
            payment_id="PAY" + order_id.removeprefix("ORD"),
            external_reference=referencia,
            solo_consulta=True,
        )

    def responder_orden_error(self, status_http: int, codigo: str = "property_value") -> None:
        """Encola un error de la Orders API en la próxima creación: `{errors: [{code, message}]}`."""
        self._ordenes_a_crear.append(
            {"status": status_http, "response": {"errors": [{"code": codigo, "message": codigo}]}}
        )

    def responder_consulta_error(self, order_id: str, status_http: int, codigo: str = "unauthorized") -> None:
        self._ordenes_por_id[order_id] = {
            "status": status_http,
            "response": {"errors": [{"code": codigo, "message": codigo}]},
        }

    def responder_busqueda(self, ordenes: list[dict]) -> None:
        """Órdenes que devuelve `search` (armarlas con `construir_orden`)."""
        self._resultado_busqueda = list(ordenes)

    def fallar_creacion(self, excepcion: BaseException) -> None:
        """Encola una excepción (p. ej. `OSError`) para la próxima creación."""
        self._ordenes_a_crear.append(excepcion)

    def antes_de_responder_creacion(self, callback) -> None:
        """Ejecuta `callback(creacion)` dentro de `create`, antes de devolver (simula una carrera con el webhook)."""
        self._antes_de_responder = callback

    def __call__(self, access_token: str) -> "MPFalso":  # `mercadopago.SDK(token)`
        self.tokens.append(access_token)
        return self


def post_webhook(
    client: TestClient,
    order_id: str | None = "ORD123",
    *,
    secreto: str | None = SECRETO,
    request_id: str | None = "req-1",
    topic: str = "order",
    firmar_id: str | None = "__order_id__",
    query_id: str | None = "__order_id__",
    body: dict | None = None,
    ts: str = TS,
):
    """POST firmado al webhook. `firmar_id`/`query_id` por defecto son `order_id`; `secreto=None` no envía firma."""
    firmado = order_id if firmar_id == "__order_id__" else firmar_id
    en_query = order_id if query_id == "__order_id__" else query_id
    headers = firmar(firmado, request_id, ts, secreto) if secreto is not None else {}
    params = {"type": topic}
    if en_query is not None:
        params["data.id"] = en_query
    cuerpo = body if body is not None else {"type": topic, "data": {"id": order_id}}
    return client.post("/api/v1/pagos/webhook", params=params, json=cuerpo, headers=headers)
