"""Unicidad de `unidades_medida` a nivel de base: solo entre activas (DD-04)."""
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.modules.unidades_medida.models import UnidadMedida

BAJA = datetime(2026, 1, 1, tzinfo=timezone.utc)


def test_unidad_medida_nombre_y_simbolo_de_una_eliminada_se_reutilizan_en_una_activa(session: Session) -> None:
    session.add(UnidadMedida(nombre="Gramo", simbolo="g", tipo="peso", deleted_at=BAJA))
    session.add(UnidadMedida(nombre="Gramo", simbolo="g", tipo="peso"))

    session.flush()

    activas = session.exec(select(UnidadMedida).where(UnidadMedida.deleted_at.is_(None), UnidadMedida.simbolo == "g")).all()
    assert len(activas) == 1


def test_unidad_medida_dos_activas_con_el_mismo_simbolo_lanzan_integrity_error(session: Session) -> None:
    session.add(UnidadMedida(nombre="Gramo", simbolo="g", tipo="peso"))
    session.flush()

    with pytest.raises(IntegrityError, match="uq_unidades_medida_simbolo_activo"):
        with session.begin_nested():
            session.add(UnidadMedida(nombre="Otro nombre", simbolo="g", tipo="peso"))
            session.flush()


def test_unidad_medida_dos_activas_con_el_mismo_nombre_lanzan_integrity_error(session: Session) -> None:
    session.add(UnidadMedida(nombre="Litro", simbolo="L", tipo="volumen"))
    session.flush()

    with pytest.raises(IntegrityError, match="uq_unidades_medida_nombre_activo"):
        with session.begin_nested():
            session.add(UnidadMedida(nombre="Litro", simbolo="lt", tipo="volumen"))
            session.flush()
