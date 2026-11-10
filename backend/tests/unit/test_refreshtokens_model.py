"""Modelos `Sesion` y `RefreshToken` (D5): forma de la metadata, sin BD."""
from sqlalchemy import BigInteger, CheckConstraint, Uuid

from app.db.models import import_all_models


def _tabla(nombre: str):
    return import_all_models().tables[nombre]


def _nombres_de(tabla, clase) -> set[str]:
    return {c.name for c in tabla.constraints if isinstance(c, clase)}


def test_sesion_id_y_refresh_token_sesion_id_son_uuid() -> None:
    assert isinstance(_tabla("sesion").c.id.type, Uuid)
    assert isinstance(_tabla("refresh_token").c.sesion_id.type, Uuid)


def test_sesion_usuario_id_es_biginteger_y_not_null() -> None:
    columna = _tabla("sesion").c.usuario_id

    assert isinstance(columna.type, BigInteger)
    assert columna.nullable is False


def test_refresh_token_ya_no_tiene_expires_at_ni_usuario_id() -> None:
    columnas = set(_tabla("refresh_token").c.keys())

    assert "expires_at" not in columnas
    assert "usuario_id" not in columnas
    assert columnas == {"id", "sesion_id", "token_hash", "revoked_at", "created_at"}


def test_sesion_tiene_las_columnas_de_d5() -> None:
    assert set(_tabla("sesion").c.keys()) == {
        "id", "usuario_id", "expires_at", "revoked_at", "revoked_reason", "created_at", "ip", "user_agent",
    }


def test_las_fk_tienen_nombre_explicito_y_apuntan_donde_corresponde() -> None:
    fk_sesion = {fk.name: fk.elements[0].column.table.name for fk in _tabla("sesion").foreign_key_constraints}
    fk_refresh = {fk.name: fk.elements[0].column.table.name for fk in _tabla("refresh_token").foreign_key_constraints}

    assert fk_sesion == {"fk_sesion_usuario_id_usuario": "usuario"}
    assert fk_refresh == {"fk_refresh_token_sesion_id_sesion": "sesion"}


def test_indices_por_fk_existen() -> None:
    assert "ix_sesion_usuario_id" in {i.name for i in _tabla("sesion").indexes}
    assert "ix_refresh_token_sesion_id" in {i.name for i in _tabla("refresh_token").indexes}


def test_checks_de_sesion_tienen_el_texto_esperado() -> None:
    checks = {c.name: str(c.sqltext) for c in _tabla("sesion").constraints if isinstance(c, CheckConstraint)}

    assert checks["ck_sesion_revoked_reason"] == "revoked_reason IN ('LOGOUT','LOGOUT_ALL','REUSO')"
    assert checks["ck_sesion_revocacion_consistente"] == "(revoked_at IS NULL) = (revoked_reason IS NULL)"


def test_refresh_token_tiene_indice_unico_parcial_de_un_solo_activo_por_sesion() -> None:
    indices = {i.name: i for i in _tabla("refresh_token").indexes}

    idx = indices["uq_refresh_token_sesion_activo"]
    assert idx.unique is True
    assert [c.name for c in idx.columns] == ["sesion_id"]
    assert str(idx.dialect_options["postgresql"]["where"]) == "revoked_at IS NULL"
