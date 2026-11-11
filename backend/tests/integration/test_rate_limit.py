"""
tests/integration/test_rate_limit.py
======================================

Pruebas de integración del RateLimitMiddleware.

Verificamos:
  - El rate limit devuelve 429 cuando se excede.
  - Los headers X-RateLimit-* están presentes.
  - El rate limit en endpoints de auth es más estricto.
"""

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit.rate_limit_middleware import RateLimitMiddleware
from app.core.rate_limit.rate_limiter import RateLimiter


@pytest.fixture(name="strict_limits")
def strict_limits_fixture():
    """Limiters chicos y explícitos (ráfaga 10 general / 5 auth, recarga lenta).

    El entorno de tests (`.env.test`) usa límites altos para no estorbar a la suite, así que estos tests fijan
    sus propios límites en vez de depender de lo que tenga el entorno.
    """
    saved = [(m, m.default_limiter, m.auth_limiter) for m in RateLimitMiddleware._instances]
    for m, _, _ in saved:
        m.default_limiter = RateLimiter(capacity=10, refill_rate_per_minute=1)
        m.auth_limiter = RateLimiter(capacity=5, refill_rate_per_minute=1)
    yield
    for m, default, auth in saved:
        m.default_limiter, m.auth_limiter = default, auth

class TestRateLimitDefault:

    def test_response_includes_ratelimit_headers(self, client: TestClient):
        """Toda respuesta de un endpoint rate-limiteado incluye X-RateLimit-*."""
        response = client.get("/api/v1/productos/")
        assert "x-ratelimit-limit" in response.headers
        assert "x-ratelimit-remaining" in response.headers

    def test_429_when_burst_exhausted(self, client: TestClient, strict_limits: None):
        """Agotar la ráfaga inicial devuelve 429."""
        # Con RATE_LIMIT_DEFAULT_BURST=10, el 11vo request dispara el 429.
        statuses = [client.get("/api/v1/productos/").status_code for _ in range(15)]
        assert 429 in statuses

    def test_429_includes_retry_after(self, client: TestClient, strict_limits: None):
        """El 429 incluye el header Retry-After con un entero positivo."""
        for _ in range(15):
            r = client.get("/api/v1/productos/")
            if r.status_code == 429:
                assert "retry-after" in r.headers
                assert int(r.headers["retry-after"]) > 0
                return
        pytest.fail("No se alcanzó el 429 luego de 15 requests")

    def test_429_usa_el_formato_unico_de_error(self, client: TestClient, strict_limits: None):
        """El 429 sale como `{detail, code, field}` con código `RATE_LIMIT_EXCEEDED`, sin la clave `error`."""
        respuesta = None
        for _ in range(15):
            r = client.get("/api/v1/productos/")
            if r.status_code == 429:
                respuesta = r
                break
        assert respuesta is not None, "No se alcanzó el 429 luego de 15 requests"
        cuerpo = respuesta.json()
        assert cuerpo["code"] == "RATE_LIMIT_EXCEEDED"
        assert cuerpo["field"] is None
        assert cuerpo["detail"]
        assert "error" not in cuerpo
        assert int(respuesta.headers["retry-after"]) > 0
        assert respuesta.headers["x-ratelimit-remaining"] == "0"

class TestRateLimitAuth:

    def test_auth_endpoint_has_stricter_limit(self, client: TestClient, strict_limits: None):
        """El limiter de auth se agota antes que el general."""
        # Con RATE_LIMIT_AUTH_BURST=5, el 6to request de login dispara el 429.
        statuses = []
        for _ in range(10):
            r = client.post(
                "/api/v1/auth/login",
                data={"username": "nobody@x.com", "password": "wrong"},
            )
            statuses.append(r.status_code)
        assert 429 in statuses
