"""`GET /health`: liveness sin credenciales, sin BD y excluido del rate limiting."""
from fastapi.testclient import TestClient

from app.core.config import settings


def test_health_sin_credenciales_responde_200_status_ok(plain_client: TestClient) -> None:
    response = plain_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_no_se_limita_por_rate_limit(plain_client: TestClient) -> None:
    total = settings.RATE_LIMIT_DEFAULT_PER_MINUTE + 1

    statuses = {plain_client.get("/health").status_code for _ in range(total)}

    assert statuses == {200}
