"""`GET /health`: liveness sin credenciales, sin BD y sin rate limiting."""
from fastapi.testclient import TestClient

from tests.support.login import fallar_login


def test_health_sin_credenciales_responde_200_status_ok(plain_client: TestClient) -> None:
    response = plain_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_cien_requests_desde_una_ip_bloqueada_en_login_responden_200(client: TestClient) -> None:
    fallar_login(client, 5)

    statuses = {client.get("/health").status_code for _ in range(100)}

    assert statuses == {200}
