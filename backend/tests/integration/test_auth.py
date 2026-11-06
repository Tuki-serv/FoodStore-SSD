import pytest
from fastapi.testclient import TestClient

# ===========================================================================
# TESTS: Registro
# ===========================================================================

class TestRegister:
    """POST /api/v1/auth/register"""

    def test_register_success_returns_201(self, client: TestClient):
        """Registro exitoso de usuario devuelve 201 y no incluye password en la respuesta."""
        payload = {
            "email": "nuevo@example.com",
            "password": "SecurePass123!",
            "nombre": "Nuevo",
            "apellido": "Usuario",
            "celular": "123123123"
        }
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "nuevo@example.com"
        assert "password" not in data

    def test_register_duplicate_email_returns_409(self, client: TestClient, normal_user: dict):
        """Registro con email ya existente devuelve error de conflicto o validación."""
        payload = {
            "email": normal_user["email"],
            "password": "AnotherPass123!",
            "nombre": "Test",
            "apellido": "User",
            "celular": "123123123"
        }
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code in [400, 403, 409]

    @pytest.mark.parametrize("payload,error_field", [
        pytest.param({"email": "x@x.com"}, "password", id="sin-password"),
        pytest.param({"password": "123"}, "email", id="sin-email"),
        pytest.param({"email": "x@x.com", "password": "123"}, "password", id="password-corto"),
        pytest.param({"email": "not-an-email", "password": "12345678"}, "email", id="email-invalido"),
    ])
    def test_register_invalid_input_returns_422(self, client: TestClient, payload: dict, error_field: str):
        """Registro con datos incompletos o mal formateados devuelve 422 Unprocessable Entity."""
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 422


# ===========================================================================
# TESTS: Login
# ===========================================================================
class TestLogin:
    """POST /api/v1/auth/login"""

    def test_login_success_returns_token_and_sets_cookie(self, client: TestClient, normal_user_data: dict, normal_user: dict):
        """Login exitoso devuelve access_token en el JSON y también setea la cookie HttpOnly."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": normal_user_data["email"],
                "password": normal_user_data["password"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "access_token" in response.cookies

        cookie = response.cookies.get("access_token")
        assert cookie is not None

        set_cookie = response.headers.get("set-cookie", "")
        assert "HttpOnly" in set_cookie or "httponly" in set_cookie.lower()

    def test_login_wrong_password_returns_401(self, client: TestClient, normal_user_data: dict, normal_user: dict):
        """Login con credenciales incorrectas devuelve 401 Unauthorized."""
        response = client.post(
            "/api/v1/auth/login",
            data={
                "username": normal_user_data["email"],
                "password": "WRONG_PASSWORD",
            },
        )
        assert response.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client: TestClient):
        """Login con usuario inexistente devuelve 401 Unauthorized."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "ghost@example.com", "password": "anything"},
        )
        assert response.status_code == 401


# ===========================================================================
# TESTS: /me (O perfil)
# ===========================================================================
class TestMe:
    """GET /api/v1/usuarios/me"""

    def test_me_with_valid_token_returns_user(self, client: TestClient, user_auth_headers: dict, normal_user_data: dict):
        """Obtener perfil con token válido devuelve los datos del usuario."""
        response = client.get("/api/v1/usuarios/me", headers=user_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == normal_user_data["email"]

    def test_me_without_token_returns_401(self, client: TestClient):
        """Intentar obtener perfil sin token devuelve 401 Unauthorized."""
        response = client.get("/api/v1/usuarios/me")
        assert response.status_code == 401


# ===========================================================================
# TESTS: RBAC
# ===========================================================================
class TestRBAC:
    """Permisos por rol"""

    def test_normal_user_cannot_list_users(self, client: TestClient, user_auth_headers: dict):
        """Un usuario normal NO puede listar todos los usuarios (requiere rol ADMIN)."""
        response = client.get("/api/v1/admin/usuarios/", headers=user_auth_headers)
        assert response.status_code == 403

    def test_admin_can_list_users(self, client: TestClient, admin_auth_headers: dict):
        """Un usuario administrador SÍ puede listar usuarios paginados."""
        response = client.get("/api/v1/admin/usuarios/", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
