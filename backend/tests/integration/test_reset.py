"""`nuke_database` borra todo lo que hay (incluida `alembic_version`) y deja la base lista para migrar."""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db.migrations import current_and_head, upgrade_to_head
from app.db.reset import nuke_database
from tests.support.schema_expectations import TABLAS_ESPERADAS


def _tablas(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(inspect(conn).get_table_names())


def test_nuke_database_sobre_base_migrada_deja_cero_tablas_y_el_upgrade_posterior_funciona(
    migrations_db: Engine,
) -> None:
    with migrations_db.begin() as conn:
        upgrade_to_head(conn)
    assert _tablas(migrations_db) == set(TABLAS_ESPERADAS) | {"alembic_version"}

    nuke_database(migrations_db)

    assert _tablas(migrations_db) == set()
    with migrations_db.begin() as conn:
        upgrade_to_head(conn)
    with migrations_db.connect() as conn:
        assert current_and_head(conn) == ("001", "001")


def test_nuke_database_borra_tambien_una_tabla_creada_a_mano_fuera_de_las_migraciones(
    migrations_db: Engine,
) -> None:
    with migrations_db.begin() as conn:
        upgrade_to_head(conn)
        conn.execute(text("CREATE TABLE unidadmedida (id SERIAL PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE resto_manual (id INTEGER REFERENCES unidadmedida(id))"))

    nuke_database(migrations_db)

    assert _tablas(migrations_db) == set()
