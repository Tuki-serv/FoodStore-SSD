"""Helpers de migraciones (Alembic) compartidos por la app, el seed, el reset y los tests."""
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection
from sqlmodel.sql.sqltypes import AutoString

BACKEND_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"


class SchemaNotReadyError(RuntimeError):
    """La base no está en la última versión del esquema (falta `alembic upgrade head`)."""


class MultipleHeadsError(RuntimeError):
    """El historial de migraciones tiene más de una cabeza (dos migraciones con el mismo padre)."""


def build_alembic_config(connection: Connection | None = None) -> Config:
    """Arma la configuración de Alembic desde `backend/alembic.ini` (ruta absoluta).

    Si se pasa `connection`, `env.py` la usa en lugar de crear un engine propio.
    """
    cfg = Config(str(ALEMBIC_INI))
    if connection is not None:
        cfg.attributes["connection"] = connection
    return cfg


def ensure_single_head(script: ScriptDirectory) -> str:
    """Devuelve la única cabeza del historial; lanza `MultipleHeadsError` listando las cabezas si hay varias."""
    heads = script.get_heads()
    if len(heads) != 1:
        raise MultipleHeadsError(
            f"El historial de migraciones debe tener una sola cabeza; se encontraron {len(heads)}: {sorted(heads)}"
        )
    return heads[0]


def upgrade_to_head(connection: Connection) -> None:
    """Aplica todas las migraciones pendientes sobre la conexión dada."""
    command.upgrade(build_alembic_config(connection), "head")


def current_and_head(connection: Connection) -> tuple[str | None, str]:
    """Devuelve (revisión actual de la base o None, revisión cabeza del historial)."""
    current = MigrationContext.configure(connection).get_current_revision()
    head = ScriptDirectory.from_config(build_alembic_config()).get_current_head()
    return current, str(head)


def ensure_schema_ready(connection: Connection) -> None:
    """Lanza `SchemaNotReadyError` si la base no está en la última versión del esquema."""
    current, head = current_and_head(connection)
    if current != head:
        raise SchemaNotReadyError(
            f"La base no está en la última versión del esquema (actual: {current or 'ninguna'}, esperada: {head}). "
            "Corré `alembic upgrade head` desde `backend/` y volvé a ejecutar el seed."
        )


def drop_all_tables(connection: Connection) -> None:
    """Borra con CASCADE todas las tablas que existan (incluida `alembic_version`), por reflexión."""
    for table_name in inspect(connection).get_table_names():
        connection.execute(text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE'))


def render_item(type_: str, obj: Any, autogen_context: Any) -> str | bool:
    """Hook `render_item` de Alembic: escribe `AutoString` de SQLModel como `sa.String(...)`.

    Devuelve `False` para cualquier otro objeto (render por defecto).
    """
    if type_ == "type" and isinstance(obj, AutoString):
        return f"sa.String(length={obj.length})" if obj.length else "sa.String()"
    return False
