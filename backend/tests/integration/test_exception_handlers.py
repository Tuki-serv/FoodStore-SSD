"""
tests/integration/test_exception_handlers.py
=============================================

Pruebas de los exception handlers globales.

Verificamos que TODOS los errores de la API se devuelvan con el formato
JSON unificado del equipo:
    {
        "detail": "...",
        "code": "...",
        "field": "..."
    }
"""

import pytest
from fastapi.testclient import TestClient


# ===========================================================================
# TESTS: Formato unificado
# ===========================================================================
class TestUnifiedErrorFormat:
    """El response de TODA excepción tiene la misma forma JSON."""

    def test_404_has_unified_format(self, client: TestClient):
        """
        Un GET a un endpoint inexistente devuelve 404 con nuestro
        formato (no el default de FastAPI).
        """
        response = client.get("/this-path-does-not-exist")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert "code" in data
        assert "field" in data
        assert data["code"] == "HTTP_404"

    def test_422_validation_error_format(self, client: TestClient):
        """
        Body inválido (ej: tipos incorrectos) → 422 con formato.
        Pydantic detecta el error y nuestro handler lo formatea.
        """
        response = client.post(
            "/api/v1/auth/register",
            json={"email": 123, "password": "123"},
        )
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        assert "code" in data
        assert "field" in data
        assert data["code"] == "VALIDATION_ERROR"
        assert data["field"] is not None

    def test_401_unauthenticated(self, client: TestClient):
        """
        Un endpoint protegido sin token → 401 con formato unificado.
        """
        response = client.get("/api/v1/usuarios/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "code" in data
        assert "field" in data
        assert data["code"] == "HTTP_401"

    def test_403_forbidden(self, client: TestClient, user_auth_headers: dict):
        """
        Un user normal intentando acceder a un endpoint de admin
        → 403 con formato unificado.
        """
        response = client.get("/api/v1/admin/usuarios", headers=user_auth_headers)
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data
        assert "code" in data
        assert "field" in data
        assert data["code"] == "HTTP_403"

class TestDomainExceptions:
    def test_invalid_login_returns_401(self, client: TestClient):
        """
        Login con password incorrecto → 401 con mensaje genérico.
        """
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@foodstore.com", "password": "wrong_password"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "code" in data
        assert "field" in data
        assert data["code"] == "HTTP_401"
