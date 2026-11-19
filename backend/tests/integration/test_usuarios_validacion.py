"""Nombre y apellido obligatorios y email normalizado en el alta y el perfil (C-14, DU-3 y DU-4)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app.modules.usuarios.models import Usuario

REGISTRO = "/api/v1/auth/register"
ALTA_ADMIN = "/api/v1/admin/usuarios/createUser"
PERFIL = "/api/v1/usuarios/me"


def _datos(**cambios: object) -> dict:
    base = {"nombre": "Ana", "apellido": "Gómez", "email": "ana-validacion@example.com", "password": "SecurePass123!"}
    return {**base, **cambios}


def _cantidad_usuarios(session: Session) -> int:
    return session.exec(select(func.count()).select_from(Usuario)).one()


class TestNombreYApellidoEnElAlta:
    def test_nombre_en_blanco_devuelve_422_con_field_nombre_y_no_crea_usuario(self, client: TestClient, session: Session):
        antes = _cantidad_usuarios(session)

        response = client.post(REGISTRO, json=_datos(nombre="   "))

        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert response.json()["field"] == "nombre"
        assert _cantidad_usuarios(session) == antes

    def test_apellido_vacio_devuelve_422_con_field_apellido(self, client: TestClient, session: Session):
        antes = _cantidad_usuarios(session)

        response = client.post(REGISTRO, json=_datos(apellido=""))

        assert response.status_code == 422
        assert response.json()["field"] == "apellido"
        assert _cantidad_usuarios(session) == antes

    def test_nombre_y_apellido_se_guardan_recortados(self, client: TestClient):
        response = client.post(REGISTRO, json=_datos(nombre=" Ana ", apellido=" Gómez "))

        assert response.status_code == 201
        assert response.json()["nombre"] == "Ana"
        assert response.json()["apellido"] == "Gómez"

    def test_alta_por_admin_con_nombre_vacio_devuelve_422(self, client: TestClient, admin_auth_headers: dict):
        response = client.post(ALTA_ADMIN, json={**_datos(nombre=""), "roles_codigos": ["CLIENT"]}, headers=admin_auth_headers)

        assert response.status_code == 422
        assert response.json()["field"] == "nombre"


class TestNombreYApellidoEnElPerfil:
    @pytest.mark.parametrize("campo", ["nombre", "apellido"])
    def test_null_explicito_devuelve_422_y_no_modifica_al_usuario(self, client: TestClient, user_auth_headers: dict, campo: str):
        antes = client.get("/api/v1/auth/me", headers=user_auth_headers).json()

        response = client.patch(PERFIL, json={campo: None}, headers=user_auth_headers)

        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert response.json()["field"] == campo
        assert client.get("/api/v1/auth/me", headers=user_auth_headers).json() == antes

    def test_apellido_en_blanco_devuelve_422_y_no_cambia(self, client: TestClient, user_auth_headers: dict):
        antes = client.get("/api/v1/auth/me", headers=user_auth_headers).json()

        response = client.patch(PERFIL, json={"apellido": "   "}, headers=user_auth_headers)

        assert response.status_code == 422
        assert response.json()["field"] == "apellido"
        assert client.get("/api/v1/auth/me", headers=user_auth_headers).json()["apellido"] == antes["apellido"]

    def test_nombre_con_espacios_se_guarda_recortado(self, client: TestClient, user_auth_headers: dict):
        response = client.patch(PERFIL, json={"nombre": "  Analía  "}, headers=user_auth_headers)

        assert response.status_code == 200
        assert response.json()["nombre"] == "Analía"

    def test_celular_null_borra_el_celular(self, client: TestClient, user_auth_headers: dict):
        assert client.patch(PERFIL, json={"celular": "2610000000"}, headers=user_auth_headers).json()["celular"] == "2610000000"

        response = client.patch(PERFIL, json={"celular": None}, headers=user_auth_headers)

        assert response.status_code == 200
        assert response.json()["celular"] is None


def _login(client: TestClient, username: str, password: str):
    return client.post("/api/v1/auth/login", data={"username": username, "password": password})


class TestEmailNormalizado:
    def test_registro_con_mayusculas_y_espacios_guarda_el_email_normalizado(self, client: TestClient, session: Session):
        response = client.post(REGISTRO, json=_datos(email=" Nueva@Example.COM "))

        assert response.status_code == 201
        assert response.json()["email"] == "nueva@example.com"
        assert session.exec(select(Usuario).where(Usuario.email == "nueva@example.com")).one() is not None

    def test_login_con_email_en_mayusculas_y_espacios_abre_sesion(self, client: TestClient, normal_user_data: dict, normal_user: dict):
        response = _login(client, f" {normal_user_data['email'].upper()} ", normal_user_data["password"])

        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_registro_duplicado_que_solo_difiere_en_mayusculas_devuelve_409(
        self, client: TestClient, session: Session, normal_user_data: dict, normal_user: dict
    ):
        antes = _cantidad_usuarios(session)

        response = client.post(REGISTRO, json=_datos(email=normal_user_data["email"].upper()))

        assert response.status_code == 409
        assert _cantidad_usuarios(session) == antes

    def test_login_con_password_incorrecta_y_email_en_mayusculas_devuelve_401_sin_sesion(
        self, client: TestClient, normal_user_data: dict, normal_user: dict
    ):
        response = _login(client, normal_user_data["email"].upper(), "incorrecta-123")

        assert response.status_code == 401
        assert response.json()["detail"] == "Credenciales incorrectas"
        assert response.headers.get_list("set-cookie") == []

    def test_alta_por_admin_con_mayusculas_guarda_el_email_en_minusculas(
        self, client: TestClient, session: Session, admin_auth_headers: dict
    ):
        response = client.post(
            ALTA_ADMIN, json={**_datos(email="Staff@Example.com"), "roles_codigos": ["CLIENT"]}, headers=admin_auth_headers
        )

        assert response.status_code == 201
        assert session.exec(select(Usuario).where(Usuario.email == "staff@example.com")).one() is not None
