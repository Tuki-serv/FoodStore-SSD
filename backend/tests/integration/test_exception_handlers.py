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


class TestAppErrorYErrorInesperado:
    """`AppError` (error de dominio) y las excepciones no controladas salen con el formato unificado."""

    @staticmethod
    def _app_con_rutas_de_prueba():
        from app.core.errors import AppError
        from app.main import create_app

        app = create_app()

        @app.get("/__test/app-error")
        def lanza_app_error():
            raise AppError(409, "INVALID_TRANSITION", "x", field=None)

        @app.get("/__test/app-error-campo")
        def lanza_app_error_con_campo():
            raise AppError(409, "DUPLICATE_VALUE", "ya existe", field="nombre")

        @app.get("/__test/app-error-headers")
        def lanza_app_error_con_headers():
            raise AppError(429, "RATE_LIMIT_EXCEEDED", "esperá", headers={"Retry-After": "7"})

        @app.get("/__test/boom")
        def lanza_error_inesperado():
            raise RuntimeError("boom")

        return app

    def test_app_error_se_formatea_con_su_codigo_y_estado(self):
        cliente = TestClient(self._app_con_rutas_de_prueba())
        response = cliente.get("/__test/app-error")
        assert response.status_code == 409
        assert response.json() == {"detail": "x", "code": "INVALID_TRANSITION", "field": None}

    def test_app_error_con_campo_lo_expone(self):
        cliente = TestClient(self._app_con_rutas_de_prueba())
        response = cliente.get("/__test/app-error-campo")
        assert response.status_code == 409
        assert response.json() == {"detail": "ya existe", "code": "DUPLICATE_VALUE", "field": "nombre"}

    def test_app_error_con_headers_los_incluye_en_la_respuesta(self):
        cliente = TestClient(self._app_con_rutas_de_prueba())
        response = cliente.get("/__test/app-error-headers")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "7"
        assert response.json() == {"detail": "esperá", "code": "RATE_LIMIT_EXCEEDED", "field": None}

    def test_app_error_sin_headers_no_agrega_retry_after(self):
        cliente = TestClient(self._app_con_rutas_de_prueba())
        response = cliente.get("/__test/app-error")
        assert "retry-after" not in response.headers

    def test_error_inesperado_devuelve_500_generico_sin_filtrar_detalle(self):
        cliente = TestClient(self._app_con_rutas_de_prueba(), raise_server_exceptions=False)
        response = cliente.get("/__test/boom")
        assert response.status_code == 500
        data = response.json()
        assert data["code"] == "INTERNAL_ERROR"
        assert data["field"] is None
        assert "boom" not in response.text


class TestFormatoUnicoEnErroresDeProtocolo:
    def test_405_metodo_no_permitido_mantiene_el_formato(self, client: TestClient):
        response = client.delete("/api/v1/auth/login")
        assert response.status_code == 405
        data = response.json()
        assert data["code"] == "HTTP_405"
        assert data["field"] is None
        assert data["detail"]

    def test_401_sin_token_en_auth_me_mantiene_el_formato(self, client: TestClient):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "HTTP_401"
        assert data["field"] is None
