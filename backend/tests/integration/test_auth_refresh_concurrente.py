"""Rotación concurrente (D17): dos renovaciones simultáneas con el MISMO refresh vigente.

A diferencia del resto de la suite, acá NO se usa la fixture `session` (una sola transacción compartida): cada
pedido abre su propia sesión de BD con commits reales, que es lo único que ejercita el `SELECT ... FOR UPDATE`.
Como los datos quedan confirmados, el test crea su propio usuario y lo borra al terminar.
"""
import threading
from collections.abc import Iterator
from datetime import timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import hash_password, hash_refresh_token, new_refresh_token
from app.core.timestamps import utc_now
from app.main import app
from app.modules.refreshtokens.models import RefreshToken, Sesion
from app.modules.usuarios.models import Usuario

EMAIL = "concurrencia-d17@example.com"


@pytest.fixture(name="escenario")
def escenario_fixture(engine_test: Engine) -> Iterator[tuple[UUID, str, int]]:
    """Usuario + sesión abierta + un refresh activo, todo confirmado en la base. Devuelve (sid, refresh, usuario_id)."""
    plano, token_hash = new_refresh_token()
    with Session(engine_test) as db:
        usuario = Usuario(nombre="Con", apellido="Currencia", email=EMAIL, password_hash=hash_password("Clave12345!"))
        db.add(usuario)
        db.commit()
        sesion = Sesion(usuario_id=usuario.id, expires_at=utc_now() + timedelta(days=7))
        db.add(sesion)
        db.commit()
        db.add(RefreshToken(sesion_id=sesion.id, token_hash=token_hash))
        db.commit()
        sid, usuario_id = sesion.id, usuario.id
    yield sid, plano, usuario_id
    with Session(engine_test) as db:
        db.exec(delete(RefreshToken).where(RefreshToken.sesion_id == sid))
        db.exec(delete(Sesion).where(Sesion.usuario_id == usuario_id))
        db.exec(delete(Usuario).where(Usuario.id == usuario_id))
        db.commit()


def test_dos_renovaciones_simultaneas_con_el_mismo_refresh_rotan_una_sola_vez_y_no_se_toman_por_reuso(
    engine_test: Engine, escenario: tuple[UUID, str, int]
) -> None:
    sid, plano, usuario_id = escenario

    def sesion_propia():
        with Session(engine_test) as db:  # una conexión por pedido, con commits reales
            yield db

    app.dependency_overrides[get_session] = sesion_propia
    barrera = threading.Barrier(2)
    respuestas: list = []
    errores: list[BaseException] = []

    def renovar() -> None:
        try:
            with TestClient(app) as cliente:
                cliente.cookies.set("refresh_token", plano, domain="testserver.local", path="/api/v1/auth")
                barrera.wait(timeout=10)
                respuestas.append(cliente.post("/api/v1/auth/refresh"))
        except BaseException as exc:  # noqa: BLE001 - se reporta en el hilo principal
            errores.append(exc)

    try:
        hilos = [threading.Thread(target=renovar) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=30)
    finally:
        app.dependency_overrides.clear()

    assert errores == []
    assert sorted(r.status_code for r in respuestas) == [200, 200]  # ninguna 500 ni 401
    # Exactamente una de las dos rotó (trae cookie nueva); la otra cayó en la gracia (sin cookie).
    con_cookie = [r for r in respuestas if r.headers.get_list("set-cookie")]
    assert len(con_cookie) == 1
    with Session(engine_test) as db:
        tokens = db.exec(select(RefreshToken).where(RefreshToken.sesion_id == sid).order_by(RefreshToken.id)).all()
        sesion = db.get(Sesion, sid)
        usuarios_con_sesion_cerrada = db.exec(
            select(Sesion).where(Sesion.usuario_id == usuario_id, Sesion.revoked_at.is_not(None))
        ).all()
    assert len(tokens) == 2
    assert [t.revoked_at is not None for t in tokens] == [True, False]
    assert tokens[0].token_hash == hash_refresh_token(plano)
    assert sesion is not None and sesion.revoked_at is None and sesion.revoked_reason is None
    assert usuarios_con_sesion_cerrada == []
    assert all(r.json()["access_token"] for r in respuestas)
