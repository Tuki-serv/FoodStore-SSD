import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import decode_access_token
from app.core.timestamps import utc_now
from app.modules.refreshtokens.models import RefreshToken, Sesion
from app.modules.usuarios.models import Usuario

def _login(client: TestClient, user_data: dict, user_agent: str | None = None):
    headers = {"User-Agent": user_agent} if user_agent else {}
    return client.post(
        "/api/v1/auth/login",
        data={"username": user_data["email"], "password": user_data["password"]},
        headers=headers,
    )


def _atributos_cookie(response, nombre: str) -> dict[str, str]:
    """Atributos del `Set-Cookie` de `nombre` (claves en minúscula; los flags valen cadena vacía)."""
    linea = next(c for c in response.headers.get_list("set-cookie") if c.startswith(f"{nombre}="))
    atributos: dict[str, str] = {}
    for parte in linea.split(";")[1:]:
        clave, _, valor = parte.strip().partition("=")
        atributos[clave.lower()] = valor
    return atributos


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

    def test_registro_con_email_de_usuario_activo_devuelve_409_y_no_duplica_el_usuario(
        self, client: TestClient, session: Session, normal_user: dict
    ):
        payload = {
            "email": normal_user["email"],
            "password": "AnotherPass123!",
            "nombre": "Test",
            "apellido": "User",
            "celular": "123123123",
        }

        response = client.post("/api/v1/auth/register", json=payload)

        assert response.status_code == 409
        assert "email ya está registrado" in response.json()["detail"]
        assert len(session.exec(select(Usuario).where(Usuario.email == normal_user["email"])).all()) == 1

    def test_alta_por_admin_con_email_existente_devuelve_409(
        self, client: TestClient, admin_auth_headers: dict, normal_user: dict
    ):
        payload = {
            "email": normal_user["email"],
            "password": "AnotherPass123!",
            "nombre": "Otro",
            "apellido": "Usuario",
            "roles_codigos": ["CLIENT"],
        }

        response = client.post("/api/v1/admin/usuarios/createUser", json=payload, headers=admin_auth_headers)

        assert response.status_code == 409
        assert "email ya está registrado" in response.json()["detail"]

    def test_registro_exitoso_no_abre_sesion_ni_setea_cookie_y_asigna_solo_el_rol_client(
        self, client: TestClient, session: Session
    ):
        payload = {
            "email": "solo-client@example.com",
            "password": "SecurePass123!",
            "nombre": "Solo",
            "apellido": "Client",
        }

        response = client.post("/api/v1/auth/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert "password" not in data and "password_hash" not in data
        usuario = session.exec(select(Usuario).where(Usuario.email == "solo-client@example.com")).one()
        assert [rol.codigo for rol in usuario.roles] == ["CLIENT"]
        assert response.headers.get_list("set-cookie") == []
        assert session.exec(select(Sesion).where(Sesion.usuario_id == usuario.id)).all() == []

    def test_registro_con_email_de_usuario_dado_de_baja_devuelve_201(
        self, client: TestClient, admin_auth_headers: dict, normal_user_data: dict, normal_user: dict
    ):
        baja = client.delete(f"/api/v1/admin/usuarios/{normal_user['id']}", headers=admin_auth_headers)
        assert baja.status_code == 204

        response = client.post("/api/v1/auth/register", json=normal_user_data)

        assert response.status_code == 201
        assert response.json()["email"] == normal_user_data["email"]
        assert response.json()["id"] != normal_user["id"]

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

    def test_login_exitoso_devuelve_access_en_el_body_sin_refresh_ni_cookie_de_access(
        self, client: TestClient, normal_user_data: dict, normal_user: dict
    ):
        response = _login(client, normal_user_data)

        assert response.status_code == 200
        data = response.json()
        assert data["token_type"] == "bearer"
        assert data["expires_in"] == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        assert data["access_token"]
        assert "refresh_token" not in data
        assert "access_token" not in response.cookies
        assert not any(c.lower().startswith("access_token=") for c in response.headers.get_list("set-cookie"))

    def test_login_setea_cookie_refresh_httponly_con_path_samesite_y_max_age_de_la_sesion(
        self, client: TestClient, normal_user_data: dict, normal_user: dict
    ):
        response = _login(client, normal_user_data)

        atributos = _atributos_cookie(response, "refresh_token")
        assert "httponly" in atributos
        assert atributos["path"] == "/api/v1/auth"
        assert atributos["samesite"].lower() == "lax"
        assert "secure" not in atributos  # configuración de test: REFRESH_COOKIE_SECURE=false
        segundos = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        assert segundos - 60 <= int(atributos["max-age"]) <= segundos

    def test_login_con_cookie_secure_configurada_marca_la_cookie_de_refresh_como_secure(
        self, client: TestClient, monkeypatch, normal_user_data: dict, normal_user: dict
    ):
        monkeypatch.setattr(settings, "REFRESH_COOKIE_SECURE", True)

        response = _login(client, normal_user_data)

        assert "secure" in _atributos_cookie(response, "refresh_token")

    def test_login_crea_una_sesion_abierta_con_vencimiento_ip_y_user_agent(
        self, client: TestClient, session: Session, normal_user_data: dict, normal_user: dict
    ):
        antes = utc_now()

        response = _login(client, normal_user_data, user_agent="TestAgent/1.0")

        sesiones = session.exec(select(Sesion).where(Sesion.usuario_id == normal_user["id"])).all()
        assert len(sesiones) == 1
        sesion = sesiones[0]
        assert sesion.revoked_at is None
        esperado = antes + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        assert abs((sesion.expires_at - esperado).total_seconds()) < 30
        assert sesion.ip
        assert sesion.user_agent == "TestAgent/1.0"
        claims = decode_access_token(response.json()["access_token"])
        assert claims is not None
        assert claims["sid"] == str(sesion.id)
        assert claims["sub"] == str(normal_user["id"])
        assert claims["roles"] == ["CLIENT"]

    def test_login_guarda_solo_el_sha256_del_refresh_de_la_cookie(
        self, client: TestClient, session: Session, normal_user_data: dict, normal_user: dict
    ):
        response = _login(client, normal_user_data)

        valor = response.cookies.get("refresh_token")
        assert valor
        activos = session.exec(select(RefreshToken).where(RefreshToken.revoked_at.is_(None))).all()
        assert [rt.token_hash for rt in activos] == [hashlib.sha256(valor.encode()).hexdigest()]
        assert valor not in {rt.token_hash for rt in activos}

    def test_login_con_password_incorrecta_no_crea_sesion_ni_cookie_de_refresh(
        self, client: TestClient, session: Session, normal_user_data: dict, normal_user: dict
    ):
        response = _login(client, {**normal_user_data, "password": "WRONG_PASSWORD"})

        assert response.status_code == 401
        assert response.json()["detail"] == "Credenciales incorrectas"
        assert not any(c.startswith("refresh_token=") for c in response.headers.get_list("set-cookie"))
        assert session.exec(select(Sesion)).all() == []

    def test_login_de_usuario_dado_de_baja_devuelve_401_sin_sesion(
        self, client: TestClient, session: Session, admin_auth_headers: dict, normal_user_data: dict, normal_user: dict
    ):
        baja = client.delete(f"/api/v1/admin/usuarios/{normal_user['id']}", headers=admin_auth_headers)
        assert baja.status_code == 204

        response = _login(client, normal_user_data)

        assert response.status_code == 401
        assert response.json()["detail"] == "Credenciales incorrectas"
        assert session.exec(select(Sesion).where(Sesion.usuario_id == normal_user["id"])).all() == []

    def test_dos_logins_abren_dos_sesiones_distintas_con_un_refresh_activo_cada_una(
        self, client: TestClient, session: Session, normal_user_data: dict, normal_user: dict
    ):
        sid_1 = decode_access_token(_login(client, normal_user_data).json()["access_token"])["sid"]
        sid_2 = decode_access_token(_login(client, normal_user_data).json()["access_token"])["sid"]

        assert sid_1 != sid_2
        sesiones = session.exec(select(Sesion).where(Sesion.usuario_id == normal_user["id"])).all()
        assert {str(s.id) for s in sesiones} == {sid_1, sid_2}
        assert all(s.revoked_at is None for s in sesiones)
        for sesion in sesiones:
            activos = session.exec(
                select(RefreshToken).where(RefreshToken.sesion_id == sesion.id, RefreshToken.revoked_at.is_(None))
            ).all()
            assert len(activos) == 1

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


# ===========================================================================
# TESTS: GET /auth/me (Bearer)
# ===========================================================================
def _access_firmado(**claims) -> str:
    base = {"type": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)}
    return jwt.encode({**base, **claims}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


class TestAuthMe:
    """GET /api/v1/auth/me"""

    def test_me_con_bearer_devuelve_email_roles_y_no_expone_el_hash(
        self, client: TestClient, user_auth_headers: dict, normal_user_data: dict
    ):
        response = client.get("/api/v1/auth/me", headers=user_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["email"] == normal_user_data["email"]
        assert [r["codigo"] for r in data["roles"]] == ["CLIENT"]
        assert "password_hash" not in data

    def test_me_sin_header_authorization_devuelve_401(self, client: TestClient):
        assert client.get("/api/v1/auth/me").status_code == 401

    def test_me_con_cookie_access_token_valida_pero_sin_bearer_devuelve_401(
        self, client: TestClient, normal_user_data: dict, normal_user: dict
    ):
        access = _login(client, normal_user_data).json()["access_token"]

        response = client.get("/api/v1/auth/me", cookies={"access_token": access})

        assert response.status_code == 401

    def test_me_con_access_vencido_devuelve_401(self, client: TestClient, normal_user: dict):
        token = _access_firmado(
            sub=str(normal_user["id"]), roles=["CLIENT"], sid="3f2b8c1e-5a47-4d0e-9b6a-1c2d3e4f5a6b",
            exp=datetime.now(timezone.utc) - timedelta(minutes=1),
        )

        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 401

    def test_me_con_access_firmado_sin_sid_devuelve_401(self, client: TestClient, normal_user: dict):
        token = _access_firmado(sub=str(normal_user["id"]), roles=["CLIENT"])

        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

        assert response.status_code == 401
