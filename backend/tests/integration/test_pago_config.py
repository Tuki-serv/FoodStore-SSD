"""`GET /pagos/config`: clave pública de MercadoPago para el brick `CardPayment` (C-20a, spec `payment-api`)."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

CONFIG = "/api/v1/pagos/config"
CLAVE_PUBLICA = "APP_USR-clave-publica-de-prueba"


@pytest.fixture
def clave_publica(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setattr(settings, "MP_PUBLIC_KEY", CLAVE_PUBLICA)
    return CLAVE_PUBLICA


def test_cliente_autenticado_recibe_la_clave_publica_y_ningun_otro_campo(
    client: TestClient, user_auth_headers: dict, clave_publica: str
) -> None:
    response = client.get(CONFIG, headers=user_auth_headers)

    assert response.status_code == 200
    assert response.json() == {"public_key": "APP_USR-clave-publica-de-prueba"}


def test_admin_sin_rol_client_tambien_recibe_la_clave(
    client: TestClient, admin_auth_headers: dict, clave_publica: str
) -> None:
    response = client.get(CONFIG, headers=admin_auth_headers)

    assert response.status_code == 200
    assert response.json()["public_key"] == CLAVE_PUBLICA


def test_la_respuesta_no_contiene_secretos(
    client: TestClient, user_auth_headers: dict, clave_publica: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "APP_USR-token-secreto-de-acceso")
    monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", "secreto-del-webhook-123")

    response = client.get(CONFIG, headers=user_auth_headers)

    assert response.status_code == 200
    assert "token-secreto-de-acceso" not in response.text
    assert "secreto-del-webhook-123" not in response.text


def test_config_no_se_interpreta_como_pedido_id(
    client: TestClient, user_auth_headers: dict, clave_publica: str
) -> None:
    response = client.get(CONFIG, headers=user_auth_headers)

    assert response.status_code != 422
    assert "pedido_id" not in response.json()


def test_anonimo_recibe_401_sin_clave(client: TestClient, clave_publica: str) -> None:
    response = client.get(CONFIG)

    assert response.status_code == 401
    assert response.json()["code"] == "HTTP_401"
    assert "public_key" not in response.json()


@pytest.mark.parametrize("valor", [None, "", "  "])
def test_sin_clave_configurada_responde_503(
    client: TestClient, user_auth_headers: dict, monkeypatch: pytest.MonkeyPatch, valor: str | None
) -> None:
    monkeypatch.setattr(settings, "MP_PUBLIC_KEY", valor)

    response = client.get(CONFIG, headers=user_auth_headers)

    assert response.status_code == 503
    assert response.json()["code"] == "HTTP_503"
