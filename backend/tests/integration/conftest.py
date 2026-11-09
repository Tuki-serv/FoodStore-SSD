"""Fixtures de integración: base auxiliar `foodstore_migrations_test` para los tests de migraciones."""
from collections.abc import Iterator

import pytest
from sqlalchemy.engine import Engine

from app.core.config import settings
from app.core.database import build_engine
from app.db.migrations import drop_all_tables
from tests.support.db_admin import ensure_database_exists
from tests.support.db_guard import is_safe_test_database_url, migrations_database_url


def _empty_migrations_database(engine: Engine) -> None:
    with engine.begin() as conn:
        drop_all_tables(conn)


@pytest.fixture(name="migrations_engine", scope="module")
def migrations_engine_fixture() -> Iterator[Engine]:
    """Engine sobre la base auxiliar de migraciones: valida la guardia `_test` antes de conectarse."""
    url = migrations_database_url(settings.DATABASE_URL)
    if not is_safe_test_database_url(url):
        pytest.exit(
            f"La base auxiliar de migraciones no termina en '_test' ({url}). Se aborta antes de conectarse.",
            returncode=2,
        )
    ensure_database_exists(url)
    engine = build_engine(settings.model_copy(update={"DATABASE_URL": url}))
    yield engine
    engine.dispose()


@pytest.fixture(name="migrations_db")
def migrations_db_fixture(migrations_engine: Engine) -> Iterator[Engine]:
    """`migrations_engine` con la base vacía antes y después de cada test que la use."""
    _empty_migrations_database(migrations_engine)
    yield migrations_engine
    _empty_migrations_database(migrations_engine)
