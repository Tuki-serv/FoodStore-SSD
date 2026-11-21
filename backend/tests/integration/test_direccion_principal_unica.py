"""Una sola dirección principal activa por usuario, garantizada por la base (C-25b1, spec `address-integrity`, RN-DI-01)."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.modules.direcciones.models import DireccionEntrega
from app.modules.direcciones.repository import DireccionRepository
from app.db.seed import seed_catalogos
from tests.support.auth_helpers import crear_usuario_con_roles


@pytest.fixture(autouse=True)
def _catalogos(session: Session) -> None:
    seed_catalogos(session)


def _direccion(session: Session, usuario_id: int, linea1: str, *, principal: bool, baja: bool = False) -> DireccionEntrega:
    direccion = DireccionEntrega(
        usuario_id=usuario_id,
        linea1=linea1,
        ciudad="Mendoza",
        es_principal=principal,
        deleted_at=datetime.now(timezone.utc) if baja else None,
    )
    session.add(direccion)
    session.flush()
    return direccion


def _principales_activas(session: Session, usuario_id: int) -> list[str]:
    session.expire_all()
    filas = session.exec(
        select(DireccionEntrega.linea1)
        .where(
            DireccionEntrega.usuario_id == usuario_id,
            DireccionEntrega.es_principal,
            DireccionEntrega.deleted_at.is_(None),
        )
        .order_by(DireccionEntrega.linea1)
    )
    return list(filas)


def test_insertar_una_segunda_principal_activa_del_mismo_usuario_es_rechazado_por_la_base(session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    _direccion(session, usuario.id, "Primera", principal=True)

    with pytest.raises(IntegrityError, match="uq_direccion_principal_activa"):
        with session.begin_nested():
            _direccion(session, usuario.id, "Segunda", principal=True)

    assert _principales_activas(session, usuario.id) == ["Primera"]


def test_una_principal_dada_de_baja_no_bloquea_a_la_nueva(session: Session) -> None:
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    _direccion(session, usuario.id, "Vieja", principal=True, baja=True)

    _direccion(session, usuario.id, "Nueva", principal=True)

    assert _principales_activas(session, usuario.id) == ["Nueva"]


def test_dos_usuarios_distintos_pueden_tener_cada_uno_su_principal(session: Session) -> None:
    ana = crear_usuario_con_roles(session, ["CLIENT"])
    beto = crear_usuario_con_roles(session, ["CLIENT"])

    _direccion(session, ana.id, "De Ana", principal=True)
    _direccion(session, beto.id, "De Beto", principal=True)

    assert _principales_activas(session, ana.id) == ["De Ana"]
    assert _principales_activas(session, beto.id) == ["De Beto"]


def test_marcar_principal_con_la_anterior_dada_de_baja_responde_200(
    client: TestClient, session: Session, user_auth_headers: dict, normal_user: dict
) -> None:
    _direccion(session, normal_user["id"], "Baja", principal=True, baja=True)
    nueva = _direccion(session, normal_user["id"], "Nueva", principal=False)

    response = client.patch(f"/api/v1/direcciones/{nueva.id}/principal", headers=user_auth_headers)

    assert response.status_code == 200
    assert _principales_activas(session, normal_user["id"]) == ["Nueva"]


def test_marcar_principal_con_otra_ya_marcada_por_una_carrera_responde_409_y_no_500(
    client: TestClient,
    session: Session,
    user_auth_headers: dict,
    normal_user: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Otra transacción ya confirmó su principal: este pedido no la ve (vista vieja) y la base lo frena."""
    _direccion(session, normal_user["id"], "Ganadora", principal=True)
    perdedora = _direccion(session, normal_user["id"], "Perdedora", principal=False)
    monkeypatch.setattr(DireccionRepository, "get_principal_by_usuario", lambda self, usuario_id: None)

    response = client.patch(f"/api/v1/direcciones/{perdedora.id}/principal", headers=user_auth_headers)

    assert response.status_code == 409
    cuerpo = response.json()
    assert (cuerpo["code"], cuerpo["field"]) == ("DUPLICATE_VALUE", "es_principal")
    assert _principales_activas(session, normal_user["id"]) == ["Ganadora"]
