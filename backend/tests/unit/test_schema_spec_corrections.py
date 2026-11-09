"""Correcciones del esquema a `knowledge-base/04` (D13), verificadas sobre la metadata sin BD."""
from sqlalchemy import BigInteger, CheckConstraint, Text

from app.db.models import import_all_models
from tests.support.schema_expectations import FK_A_USUARIO_ESPERADAS


def _columnas_con_fk_a_usuario_id() -> set[str]:
    metadata = import_all_models()
    return {
        f"{tabla.name}.{col.name}"
        for tabla in metadata.tables.values()
        for col in tabla.columns
        for fk in col.foreign_keys
        if fk.column.table.name == "usuario" and fk.column.name == "id"
    }


def test_usuario_id_es_biginteger() -> None:
    usuario = import_all_models().tables["usuario"]

    assert isinstance(usuario.c.id.type, BigInteger)


def test_las_seis_fk_hacia_usuario_id_son_biginteger() -> None:
    metadata = import_all_models()

    for ref in sorted(FK_A_USUARIO_ESPERADAS):
        tabla, columna = ref.split(".")
        assert isinstance(metadata.tables[tabla].c[columna].type, BigInteger), ref


def test_toda_fk_hacia_usuario_id_esta_en_la_lista_conocida() -> None:
    """Si un change futuro agrega una FK a `usuario.id`, debe sumarla a la lista con tipo BigInteger."""
    assert _columnas_con_fk_a_usuario_id() == set(FK_A_USUARIO_ESPERADAS)


def test_categorias_parent_id_tiene_on_delete_set_null() -> None:
    parent_id = import_all_models().tables["categorias"].c.parent_id

    (fk,) = parent_id.foreign_keys
    assert fk.ondelete == "SET NULL"
    assert parent_id.nullable is True


def test_productos_tiene_check_de_stock_no_negativo_ademas_del_de_precio() -> None:
    productos = import_all_models().tables["productos"]

    checks = {c.name: str(c.sqltext) for c in productos.constraints if isinstance(c, CheckConstraint)}

    assert checks.get("ck_producto_stock_no_negativo") == "stock_cantidad >= 0"
    assert "ck_producto_precio_no_negativo" in checks


def test_direccion_entrega_linea1_es_text_y_not_null() -> None:
    linea1 = import_all_models().tables["direccion_entrega"].c.linea1

    assert isinstance(linea1.type, Text)
    assert linea1.nullable is False
