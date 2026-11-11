"""Borde de MercadoPago para tests del webhook: doble del SDK (consulta del pago) y envío de notificaciones firmadas.

La firma NO se mockea: `post_webhook` firma con `tests.support.mp_firma.firmar` (HMAC real).
"""
from fastapi.testclient import TestClient

from tests.support.mp_firma import firmar

SECRETO = "secreto-de-prueba"  # valor literal de test: nunca el del `.env`
TS = "1700000000000"


class MPFalso:
    """Doble de `mercadopago.SDK`: `payment().get(id)` devuelve lo configurado con `responder` y registra las llamadas."""

    def __init__(self) -> None:
        self.llamadas: list[int] = []
        self._respuestas: dict[int, dict] = {}

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
        return self

    def payment(self) -> "MPFalso":
        return self

    def get(self, payment_id: int) -> dict:
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
