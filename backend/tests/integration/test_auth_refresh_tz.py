"""Refresh de sesión con `expires_at` leído de la base (con zona, D11)."""
from datetime import timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.timestamps import utc_now
from app.modules.usuarios.models import RefreshToken


def _login(client: TestClient, normal_user: dict, normal_user_data: dict) -> dict:
    response = client.post(
        "/api/v1/auth/login",
        data={"username": normal_user_data["email"], "password": normal_user_data["password"]},
    )
    assert response.status_code == 200
    return response.json()


def test_refresh_con_expires_at_futuro_leido_de_la_base_devuelve_200(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    tokens = _login(client, normal_user, normal_user_data)
    session.expire_all()

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_refresh_con_expires_at_en_el_pasado_devuelve_401_expirado(
    client: TestClient, session: Session, normal_user: dict, normal_user_data: dict
) -> None:
    tokens = _login(client, normal_user, normal_user_data)
    for rt in session.exec(select(RefreshToken).where(RefreshToken.usuario_id == normal_user["id"])).all():
        rt.expires_at = utc_now() - timedelta(days=1)
        session.add(rt)
    session.commit()
    session.expire_all()

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    assert response.status_code == 401
    assert "Refresh token expirado" in response.json()["detail"]
