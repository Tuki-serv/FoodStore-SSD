"""Borde de MercadoPago para tests del webhook: doble del SDK (consulta del pago) y envío de notificaciones firmadas.

La firma NO se mockea: `post_webhook` firma con `tests.support.mp_firma.firmar` (HMAC real).
"""
import warnings

from fastapi.testclient import TestClient

from tests.support.mp_firma import firmar

SECRETO = "secreto-de-prueba"  # valor literal de test: nunca el del `.env`
TS = "1700000000000"


class CreacionRegistrada:
    """Una llamada a `payment().create(...)`: cuerpo enviado y header `x-idempotency-key`."""

    def __init__(self, cuerpo: dict, headers: dict) -> None:
        self.cuerpo = cuerpo
        self.headers = headers

    @property
    def idempotency_key(self) -> str | None:
        return self.headers.get("x-idempotency-key")


class MPFalso:
    """Doble de `mercadopago.SDK`.

    - `payment().get(id)` devuelve lo configurado con `responder` y registra las llamadas en `llamadas`.
    - `payment().create(datos, request_options)` registra cuerpo y headers en `creaciones` y devuelve lo configurado
      con `responder_creacion` (o lanza lo configurado con `fallar_creacion`).
    """

    def __init__(self) -> None:
        self.llamadas: list[int] = []
        self.creaciones: list[CreacionRegistrada] = []
        self.tokens: list[str] = []
        self._respuestas: dict[int, dict] = {}
        self._creaciones_configuradas: list[dict | BaseException] = []
        self._antes_de_responder = None

    def responder_creacion(
        self,
        status_http: int = 201,
        estado: str = "approved",
        detalle: str | None = "accredited",
        payment_id: int | None = 1001,
        **extra,
    ) -> None:
        """Encola la respuesta de la próxima creación (la última se repite si se acaban)."""
        response: dict = {"status": estado, "status_detail": detalle, **extra}
        if payment_id is not None:
            response["id"] = payment_id
        self._creaciones_configuradas.append({"status": status_http, "response": response})

    def responder_creacion_error(self, status_http: int, causa: str = "invalid_token") -> None:
        self._creaciones_configuradas.append(
            {"status": status_http, "response": {"message": causa, "cause": [{"code": causa}]}}
        )

    def fallar_creacion(self, excepcion: BaseException) -> None:
        """Encola una excepción (p. ej. `OSError`) para la próxima creación."""
        self._creaciones_configuradas.append(excepcion)

    def antes_de_responder_creacion(self, callback) -> None:
        """Ejecuta `callback(creacion)` dentro de `create`, antes de devolver (simula una carrera con el webhook)."""
        self._antes_de_responder = callback

    def responder(
        self,
        payment_id: int,
        referencia: str | None,
        estado: str = "approved",
        http_status: int = 200,
        merchant_order_id: int | None = None,
    ) -> None:
        response: dict = {"id": payment_id, "status": estado, "external_reference": referencia}
        if merchant_order_id is not None:
            response["order"] = {"id": merchant_order_id}
        self._respuestas[payment_id] = {"status": http_status, "response": response}

    def __call__(self, access_token: str) -> "MPFalso":  # `mercadopago.SDK(token)`
        self.tokens.append(access_token)
        return self

    def payment(self) -> "MPFalso":
        return self

    def create(self, datos: dict, request_options=None) -> dict:
        if "notification_url" in datos:  # el SDK real lo emite en cada creación con notification_url
            warnings.warn("notification_url is deprecated; use Webhooks instead.", DeprecationWarning, stacklevel=2)
        headers = dict(request_options.custom_headers or {}) if request_options is not None else {}
        creacion = CreacionRegistrada(datos, headers)
        self.creaciones.append(creacion)
        if self._antes_de_responder is not None:
            self._antes_de_responder(creacion)
        indice = min(len(self.creaciones), len(self._creaciones_configuradas)) - 1
        if indice < 0:
            raise AssertionError("MPFalso.create sin respuesta configurada (usar responder_creacion)")
        configurada = self._creaciones_configuradas[indice]
        if isinstance(configurada, BaseException):
            raise configurada
        return configurada

    def get(self, payment_id: int, request_options=None) -> dict:
        self.llamadas.append(payment_id)
        return self._respuestas.get(payment_id, {"status": 404, "response": {"message": "not found"}})


def post_webhook(
    client: TestClient,
    payment_id: str | None = "123",
    *,
    secreto: str | None = SECRETO,
    request_id: str | None = "req-1",
    topic: str = "payment",
    firmar_id: str | None = "__payment_id__",
    query_id: str | None = "__payment_id__",
    body: dict | None = None,
    ts: str = TS,
):
    """POST firmado al webhook. `firmar_id`/`query_id` por defecto son `payment_id`; `secreto=None` no envía firma."""
    firmado = payment_id if firmar_id == "__payment_id__" else firmar_id
    en_query = payment_id if query_id == "__payment_id__" else query_id
    headers = firmar(firmado, request_id, ts, secreto) if secreto is not None else {}
    params = {"type": topic}
    if en_query is not None:
        params["data.id"] = en_query
    cuerpo = body if body is not None else {"type": topic, "data": {"id": payment_id}}
    return client.post("/api/v1/pagos/webhook", params=params, json=cuerpo, headers=headers)
