"""Guardia de seguridad de la BD de tests: solo se opera sobre bases `*_test`."""
import pytest

from tests.support.db_guard import is_safe_test_database_url

BASE = "postgresql+psycopg://user:pass@localhost:5433/{db}"


@pytest.mark.parametrize("db", ["foodstore_test", "otra_cosa_test", "x_test"])
def test_is_safe_test_database_url_nombre_termina_en_test_devuelve_true(db: str) -> None:
    assert is_safe_test_database_url(BASE.format(db=db)) is True


@pytest.mark.parametrize("db", ["foodstore", "myapp_db", "test", "foodstore_testing"])
def test_is_safe_test_database_url_nombre_no_termina_en_test_devuelve_false(db: str) -> None:
    assert is_safe_test_database_url(BASE.format(db=db)) is False


def test_is_safe_test_database_url_con_query_string_evalua_solo_el_nombre_de_la_base() -> None:
    assert is_safe_test_database_url(BASE.format(db="foodstore_test") + "?sslmode=disable") is True
    assert is_safe_test_database_url(BASE.format(db="foodstore") + "?options=x_test") is False


def test_is_safe_test_database_url_usuario_con_sufijo_test_pero_base_de_desarrollo_devuelve_false() -> None:
    url = "postgresql+psycopg://app_test:pass@localhost:5433/foodstore"
    assert is_safe_test_database_url(url) is False


def test_is_safe_test_database_url_sin_nombre_de_base_devuelve_false() -> None:
    assert is_safe_test_database_url("postgresql+psycopg://user:pass@localhost:5433") is False
