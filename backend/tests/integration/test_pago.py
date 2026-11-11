import pytest
from fastapi.testclient import TestClient

from tests.support.mp_webhook import post_webhook

class TestPago:
    """POST /api/v1/pagos/crear"""

    def test_crear_pago_returns_404_if_pedido_not_found(self, client: TestClient, user_auth_headers: dict):
        """Intentar crear pago para un pedido que no existe devuelve 404 Formato Unificado."""
        response = client.post(
            "/api/v1/pagos/crear",
            json={
                "pedido_id": 999999,
                "token": "tok-1",
                "payment_method_id": "visa",
                "installments": 1,
                "payer": {"email": "a@test.com"},
            },
            headers=user_auth_headers
        )
        assert response.status_code == 404
        data = response.json()
        assert data["code"] == "HTTP_404"
        
    def test_webhook_mercadopago_invalid_payload(self, client: TestClient, mp_sdk):
        """Si el webhook recibe una notificación firmada de un tipo no soportado, la ignora."""
        response = post_webhook(client, "123", topic="invalid_topic")
        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
