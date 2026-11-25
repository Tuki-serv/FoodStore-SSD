"""Helpers compartidos por los tests de sesión (login, renovación, lectura de sesiones)."""
from datetime import timedelta
from itertools import count
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, decode_access_token
from app.core.timestamps import utc_now
from app.modules.refreshtokens.models import RefreshToken, Sesion
from app.modules.usuarios.models import Rol, Usuario
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


_secuencia_usuarios = count(1)


def crear_usuario_con_roles(session: Session, roles: list[str]) -> Usuario:
    """Crea un `Usuario` sin bcrypt con los roles del catálogo en el orden recibido (la fixture `client` los siembra)."""
    usuario = Usuario(
        email=f"rbac{next(_secuencia_usuarios)}-{uuid4().hex[:8]}@test.local",
        password_hash=DUMMY_PASSWORD_HASH,
        nombre="Rbac",
        apellido="Test",
    )
    for codigo in roles:
        rol = session.get(Rol, codigo)
        assert rol is not None, f"El rol {codigo} no existe en el catálogo de la BD de tests"
        usuario.roles.append(rol)
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario


def bearer_con_roles(session: Session, roles: list[str], *, claims_roles: list[str] | None = None) -> dict[str, str]:
    """Headers `Authorization` de un usuario nuevo con `roles` en la BD; el claim `roles` puede desfasarse a propósito."""
    return bearer_de_usuario(session, crear_usuario_con_roles(session, roles), claims_roles or roles)


def bearer_de_usuario(session: Session, usuario: Usuario, claims_roles: list[str]) -> dict[str, str]:
    """Access de un usuario existente con una sesión abierta real (el `sid` apunta a una fila de `sesion`).

    El backend exige que la sesión del `sid` exista y esté abierta (revocación inmediata), así que cada llamada inserta
    una sesión nueva con el vencimiento de un login. Para un `sid` sin sesión usar `access_sin_sesion`.
    """
    sesion = Sesion(usuario_id=usuario.id, expires_at=utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    session.add(sesion)
    session.commit()
    access = create_access_token(sub=str(usuario.id), roles=claims_roles, sid=str(sesion.id))
    return bearer(access)


def access_sin_sesion(usuario_id: int, roles: list[str]) -> dict[str, str]:
    """Access bien firmado y vigente cuyo `sid` no corresponde a ninguna sesión (debe dar 401)."""
    return bearer(create_access_token(sub=str(usuario_id), roles=roles, sid=str(uuid4())))
