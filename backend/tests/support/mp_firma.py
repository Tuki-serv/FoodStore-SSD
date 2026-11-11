"""Firma de webhooks de MercadoPago para tests: HMAC-SHA256 real del manifest (nunca se mockea el validador)."""
import hashlib
import hmac


def firmar(data_id: str | None, request_id: str | None, ts: str, secreto: str) -> dict[str, str]:
    """Headers `x-signature` (y `x-request-id` si se informa) de una notificación firmada con `secreto`.

    Manifest: `id:<data_id>;request-id:<request_id>;ts:<ts>;`, omitiendo los pares ausentes.
    """
    manifest = ""
    if data_id is not None:
        manifest += f"id:{data_id};"
    if request_id is not None:
        manifest += f"request-id:{request_id};"
    manifest += f"ts:{ts};"
    digest = hmac.new(secreto.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {"x-signature": f"ts={ts},v1={digest}"}
    if request_id is not None:
        headers["x-request-id"] = request_id
    return headers
