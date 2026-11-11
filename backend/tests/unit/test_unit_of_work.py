"""Unit of Work reentrante: solo la UoW más externa confirma; las anidadas usan SAVEPOINT (D6, C-05)."""
import pytest
from sqlmodel import Session, select

from app.core.unit_of_work import UnitOfWork
from app.modules.usuarios.models import Rol


class _Boom(Exception):
    pass


def _rol(codigo: str) -> Rol:
    return Rol(codigo=codigo, nombre=codigo, descripcion="uow test")


def _existe(session: Session, codigo: str) -> bool:
    session.expire_all()
    return session.exec(select(Rol).where(Rol.codigo == codigo)).first() is not None


def test_uow_anidada_no_confirma_por_si_sola_si_la_externa_falla(session: Session) -> None:
    with pytest.raises(_Boom):
        with UnitOfWork(session):
            with UnitOfWork(session):
                session.add(_rol("UOW_INTERNA"))
            raise _Boom()

    assert _existe(session, "UOW_INTERNA") is False


def test_uow_externa_y_anidada_sin_errores_confirman_ambas_filas(session: Session) -> None:
    with UnitOfWork(session):
        session.add(_rol("UOW_EXTERNA"))
        with UnitOfWork(session):
            session.add(_rol("UOW_ANIDADA"))

    assert _existe(session, "UOW_EXTERNA") is True
    assert _existe(session, "UOW_ANIDADA") is True


def test_uow_anidada_que_falla_revierte_su_savepoint_y_la_externa_confirma_lo_suyo(session: Session) -> None:
    with UnitOfWork(session):
        session.add(_rol("UOW_PROPIA"))
        try:
            with UnitOfWork(session):
                session.add(_rol("UOW_REVERTIDA"))
                raise _Boom()
        except _Boom:
            pass

    assert _existe(session, "UOW_PROPIA") is True
    assert _existe(session, "UOW_REVERTIDA") is False


def test_uow_anidada_relanza_siempre_su_excepcion(session: Session) -> None:
    with UnitOfWork(session):
        with pytest.raises(_Boom):
            with UnitOfWork(session):
                raise _Boom()


def test_uow_sola_confirma_al_salir_y_revierte_con_error(session: Session) -> None:
    with UnitOfWork(session):
        session.add(_rol("UOW_SOLA_OK"))
    with pytest.raises(_Boom):
        with UnitOfWork(session):
            session.add(_rol("UOW_SOLA_ERROR"))
            raise _Boom()

    assert _existe(session, "UOW_SOLA_OK") is True
    assert _existe(session, "UOW_SOLA_ERROR") is False


def test_uow_commit_explicito_en_una_anidada_no_confirma_la_transaccion_externa(session: Session) -> None:
    with pytest.raises(_Boom):
        with UnitOfWork(session):
            with UnitOfWork(session) as interna:
                session.add(_rol("UOW_COMMIT_INTERNO"))
                interna.commit()
            raise _Boom()

    assert _existe(session, "UOW_COMMIT_INTERNO") is False


@pytest.mark.parametrize("falla", [False, True])
def test_uow_la_profundidad_vuelve_a_cero_tras_salir(session: Session, falla: bool) -> None:
    try:
        with UnitOfWork(session):
            with UnitOfWork(session):
                if falla:
                    raise _Boom()
    except _Boom:
        pass

    assert session.info.get("uow_depth", 0) == 0
