"""El seed exige el esquema al día: no crea tablas y pide `alembic upgrade head` si falta migrar."""
import pytest
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.db.migrations import SchemaNotReadyError, upgrade_to_head
from app.db.seed import seed


def _tablas(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(inspect(conn).get_table_names())


def test_seed_sobre_base_sin_migrar_lanza_error_que_pide_alembic_upgrade_head_y_no_crea_tablas(
    migrations_db: Engine,
) -> None:
    with pytest.raises(SchemaNotReadyError, match="alembic upgrade head"):
        seed(migrations_db)

    assert _tablas(migrations_db) == set()


def test_seed_sobre_base_en_version_vieja_lanza_error_y_no_inserta_filas(migrations_db: Engine) -> None:
    with migrations_db.begin() as conn:
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))
        conn.execute(text("INSERT INTO alembic_version VALUES ('000')"))

    with pytest.raises(SchemaNotReadyError, match=r"actual: 000, esperada: 002"):
        seed(migrations_db)

    assert _tablas(migrations_db) == {"alembic_version"}


def test_seed_sobre_base_migrada_inserta_los_cuatro_roles_de_catalogo(migrations_db: Engine) -> None:
    with migrations_db.begin() as conn:
        upgrade_to_head(conn)

    seed(migrations_db)

    with migrations_db.connect() as conn:
        roles = {codigo for (codigo,) in conn.execute(text("SELECT codigo FROM rol"))}
    assert roles == {"ADMIN", "STOCK", "PEDIDOS", "CLIENT"}
