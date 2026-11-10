"""Login sin diferencia de tiempo por existencia del usuario: siempre se hace una verificación bcrypt.

Se espía `verify_password` (la primitiva de `core/security.py`, borde de CPU) en el service de login.
"""
import pytest
from fastapi.testclient import TestClient

from app.core import security
from app.core.security import DUMMY_PASSWORD_HASH
from app.modules.auth import service as auth_service


@pytest.fixture(name="llamadas_verify")
def llamadas_verify_fixture(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, str]]:
    llamadas: list[tuple[str, str]] = []
    real = security.verify_password

    def espia(plain: str, hashed: str) -> bool:
        llamadas.append((plain, hashed))
        return real(plain, hashed)

    monkeypatch.setattr(auth_service, "verify_password", espia)
    return llamadas


def _login(client: TestClient, email: str, password: str):
    return client.post("/api/v1/auth/login", data={"username": email, "password": password})


def test_login_con_email_inexistente_verifica_bcrypt_contra_el_hash_de_relleno_y_responde_igual_que_con_password_incorrecta(
    client: TestClient, llamadas_verify: list, normal_user_data: dict, normal_user: dict
) -> None:
    incorrecta = _login(client, normal_user_data["email"], "WRONG_PASSWORD")
    llamadas_verify.clear()

    inexistente = _login(client, "fantasma@example.com", "WRONG_PASSWORD")

    assert llamadas_verify == [("WRONG_PASSWORD", DUMMY_PASSWORD_HASH)]
    assert inexistente.status_code == incorrecta.status_code == 401
    assert inexistente.json() == incorrecta.json()
    assert inexistente.json()["detail"] == "Credenciales incorrectas"


def test_login_de_usuario_dado_de_baja_tambien_verifica_contra_el_hash_de_relleno(
    client: TestClient, llamadas_verify: list, admin_auth_headers: dict, normal_user_data: dict, normal_user: dict
) -> None:
    baja = client.delete(f"/api/v1/admin/usuarios/{normal_user['id']}", headers=admin_auth_headers)
    assert baja.status_code == 204
    llamadas_verify.clear()

    response = _login(client, normal_user_data["email"], normal_user_data["password"])

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales incorrectas"
    assert llamadas_verify == [(normal_user_data["password"], DUMMY_PASSWORD_HASH)]


def test_login_con_usuario_existente_verifica_contra_su_propio_hash_y_no_contra_el_de_relleno(
    client: TestClient, llamadas_verify: list, normal_user_data: dict, normal_user: dict
) -> None:
    response = _login(client, normal_user_data["email"], normal_user_data["password"])

    assert response.status_code == 200
    assert len(llamadas_verify) == 1
    assert llamadas_verify[0][1] != DUMMY_PASSWORD_HASH
