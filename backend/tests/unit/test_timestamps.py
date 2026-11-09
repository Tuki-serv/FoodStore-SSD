"""Fechas con zona horaria (D11): `utc_now()` y las 32 columnas `TIMESTAMPTZ` (sin BD)."""
from datetime import timedelta

from sqlalchemy import DateTime

from app.core.timestamps import utc_now
from app.db.models import import_all_models
from tests.support.schema_expectations import COLUMNAS_DE_FECHA_ESPERADAS


def test_utc_now_devuelve_datetime_con_zona_y_desplazamiento_cero() -> None:
    ahora = utc_now()

    assert ahora.tzinfo is not None
    assert ahora.utcoffset() == timedelta(0)


def test_utc_now_dos_llamadas_devuelven_instantes_no_decrecientes() -> None:
    primero = utc_now()
    segundo = utc_now()

    assert segundo >= primero


def test_columnas_datetime_de_la_metadata_son_exactamente_las_32_esperadas() -> None:
    metadata = import_all_models()

    encontradas = {
        f"{tabla.name}.{col.name}"
        for tabla in metadata.tables.values()
        for col in tabla.columns
        if isinstance(col.type, DateTime)
    }

    assert len(COLUMNAS_DE_FECHA_ESPERADAS) == 32
    assert encontradas == set(COLUMNAS_DE_FECHA_ESPERADAS)


def test_todas_las_columnas_datetime_tienen_timezone_true() -> None:
    metadata = import_all_models()

    sin_zona = sorted(
        f"{tabla.name}.{col.name}"
        for tabla in metadata.tables.values()
        for col in tabla.columns
        if isinstance(col.type, DateTime) and not col.type.timezone
    )

    assert sin_zona == []
