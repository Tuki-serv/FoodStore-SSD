"""Verificación de la firma de los webhooks de MercadoPago (adaptador del validador oficial del SDK)."""
import logging

from mercadopago.webhook import InvalidWebhookSignatureError, WebhookSignatureValidator

from app.core.errors import AppError

logger = logging.getLogger(__name__)


def verificar_firma_webhook(
    x_signature: str | None, x_request_id: str | None, data_id: str | None, secreto: str
) -> None:
    """Valida `x-signature` (HMAC-SHA256 del manifest) o lanza `AppError(401)` con un mensaje genérico.

    El motivo concreto solo se loguea (junto al `x-request-id`); nunca el secreto ni el hash. Sin ventana de `ts` (OQ-2).
    """
    try:
        WebhookSignatureValidator.validate(x_signature, x_request_id, data_id, secreto)
    except InvalidWebhookSignatureError as exc:
        logger.warning("Firma de webhook MP inválida: reason=%s x-request-id=%s", exc.reason, x_request_id)
        raise AppError(401, "HTTP_401", "Firma de webhook inválida") from exc
