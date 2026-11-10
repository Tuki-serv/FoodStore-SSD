"""Helpers compartidos por los tests de sesión (login, renovación, lectura de sesiones)."""
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.security import decode_access_token
from app.modules.refreshtokens.models import RefreshToken, Sesion
from tests.conftest import presentar_refresh


def iniciar_sesion(client: TestClient, user_data: dict, user_agent: str | None = None):
    headers = {"User-Agent": user_agent} if user_agent else {}
    response = client.post(
        "/api/v1/auth/login",
        data={"username": user_data["email"], "password": user_data["password"]},
        headers=headers,
    )
    assert response.status_code == 200
    return response


def renovar(client: TestClient, valor: str | None, user_agent: str | None = None):
    """Presenta `valor` como cookie (o ninguna) y llama a `/auth/refresh` sin cuerpo."""
    presentar_refresh(client, valor)
    headers = {"User-Agent": user_agent} if user_agent else {}
    return client.post("/api/v1/auth/refresh", headers=headers)


def bearer(access: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access}"}


def sesion_del_access(session: Session, access: str) -> Sesion:
    sid = decode_access_token(access)["sid"]
    session.expire_all()
    return session.exec(select(Sesion).where(Sesion.id == sid)).one()


def refresh_tokens_de(session: Session, sesion: Sesion) -> list[RefreshToken]:
    session.expire_all()
    return list(
        session.exec(select(RefreshToken).where(RefreshToken.sesion_id == sesion.id).order_by(RefreshToken.id)).all()
    )


def todas_las_sesiones(session: Session) -> list[Sesion]:
    session.expire_all()
    return list(session.exec(select(Sesion)).all())


def cookie_de_refresh_borrada(response) -> bool:
    linea = next((c for c in response.headers.get_list("set-cookie") if c.startswith("refresh_token=")), None)
    return linea is not None and "max-age=0" in linea.lower() and "path=/api/v1/auth" in linea.lower()
