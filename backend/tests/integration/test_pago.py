import pytest
from fastapi.testclient import TestClient

class TestPago:
    """POST /api/v1/pagos/crear"""

    def test_crear_preferencia_pago_returns_404_if_pedido_not_found(self, client: TestClient, user_auth_headers: dict):
        """Intentar crear pago para un pedido que no existe devuelve 404 Formato Unificado."""
        response = client.post(
            "/api/v1/pagos/crear",
            json={"pedido_id": 999999},
            headers=user_auth_headers
        )
        assert response.status_code == 404
        data = response.json()
        assert data["code"] == "HTTP_404"
        
    def test_webhook_mercadopago_invalid_payload(self, client: TestClient):
        """Si el webhook recibe un payload inválido o tipo no soportado, lo ignora."""
        payload = {"type": "invalid_topic", "data": {"id": "123"}}
        response = client.post(
            "/api/v1/pagos/webhook",
            json=payload
        )
        assert response.status_code == 200
        assert response.json()["status"] == "ignored"
