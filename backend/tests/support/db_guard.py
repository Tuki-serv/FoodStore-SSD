"""Guardia de seguridad: los tests solo pueden correr contra bases cuyo nombre termina en `_test`."""
from sqlalchemy.engine import make_url


def is_safe_test_database_url(database_url: str) -> bool:
    """True si el nombre de la base (path de la URL) termina en `_test`.

    Solo se evalúa el nombre de la base: el usuario, el host y el query string no cuentan.
    """
    database = make_url(database_url).database
    return bool(database) and database.endswith("_test")
