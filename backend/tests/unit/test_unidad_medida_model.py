"""`UnidadMedida` declara unicidad solo entre activas (DD-04), sin UNIQUE total (sin BD)."""
import pytest
from sqlalchemy import UniqueConstraint

from app.modules.unidades_medida.models import UnidadMedida


def _indices_por_nombre() -> dict:
    return {idx.name: idx for idx in UnidadMedida.__table__.indexes}


@pytest.mark.parametrize(
    "nombre_indice, columna",
    [
        ("uq_unidades_medida_nombre_activo", "nombre"),
        ("uq_unidades_medida_simbolo_activo", "simbolo"),
    ],
)
def test_unidad_medida_tiene_indice_unico_parcial_para_activas(nombre_indice: str, columna: str) -> None:
    indices = _indices_por_nombre()

    assert nombre_indice in indices
    idx = indices[nombre_indice]
    assert idx.unique is True
    assert [c.name for c in idx.columns] == [columna]
    assert str(idx.dialect_options["postgresql"]["where"]) == "deleted_at IS NULL"


@pytest.mark.parametrize("columna", ["nombre", "simbolo"])
def test_unidad_medida_columna_no_tiene_unique_total(columna: str) -> None:
    tabla = UnidadMedida.__table__

    assert not tabla.c[columna].unique
    constraints_sobre_columna = [
        c
        for c in tabla.constraints
        if isinstance(c, UniqueConstraint) and columna in {col.name for col in c.columns}
    ]
    assert constraints_sobre_columna == []
