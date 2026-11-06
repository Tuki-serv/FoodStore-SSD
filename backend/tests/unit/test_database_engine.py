"""`build_engine` respeta `SQL_ECHO`. Solo construye el engine: no conecta a la BD."""
import pytest

from app.core.config import Settings
from app.core.database import build_engine


@pytest.mark.parametrize("raw, expected", [("false", False), ("true", True)])
def test_build_engine_echo_refleja_sql_echo(
    monkeypatch: pytest.MonkeyPatch, required_env: dict[str, str], raw: str, expected: bool
) -> None:
    monkeypatch.setenv("SQL_ECHO", raw)
    cfg = Settings(_env_file=None)

    engine = build_engine(cfg)

    assert engine.echo is expected


def test_build_engine_usa_database_url_tal_cual(required_env: dict[str, str]) -> None:
    cfg = Settings(_env_file=None)

    engine = build_engine(cfg)

    assert engine.url.render_as_string(hide_password=False) == required_env["DATABASE_URL"]
