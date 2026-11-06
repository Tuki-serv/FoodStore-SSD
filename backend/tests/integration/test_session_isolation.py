"""Humo del aislamiento por test (D5): el rollback de la transacción externa evita colisiones entre tests."""
from sqlmodel import Session, select

from app.core.security import hash_password
from app.modules.usuarios.models import Usuario

EMAIL = "aislamiento@example.com"


def _insertar_usuario(session: Session) -> None:
    session.add(Usuario(email=EMAIL, password_hash=hash_password("x" * 12), nombre="Iso", apellido="Lamiento"))
    session.commit()


def test_primer_test_inserta_el_email(session: Session) -> None:
    _insertar_usuario(session)

    assert session.exec(select(Usuario).where(Usuario.email == EMAIL)).one().email == EMAIL


def test_segundo_test_inserta_el_mismo_email_sin_colision(session: Session) -> None:
    assert session.exec(select(Usuario).where(Usuario.email == EMAIL)).first() is None

    _insertar_usuario(session)

    assert session.exec(select(Usuario).where(Usuario.email == EMAIL)).one().email == EMAIL
