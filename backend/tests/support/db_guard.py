"""Guardia de seguridad: los tests solo pueden correr contra bases cuyo nombre termina en `_test`."""
from sqlalchemy.engine import make_url


def is_safe_test_database_url(database_url: str) -> bool:
    """True si el nombre de la base (path de la URL) termina en `_test`.

    Solo se evalúa el nombre de la base: el usuario, el host y el query string no cuentan.
    """
    database = make_url(database_url).database
    return bool(database) and database.endswith("_test")


MIGRATIONS_DATABASE_NAME = "foodstore_migrations_test"


def migrations_database_url(database_url: str) -> str:
    """URL de la base auxiliar de los tests de migraciones: mismo servidor, otro nombre de base.

    Conserva host, puerto, usuario, contraseña y query; solo cambia el nombre a `foodstore_migrations_test`.
    """
    return make_url(database_url).set(database=MIGRATIONS_DATABASE_NAME).render_as_string(hide_password=False)
