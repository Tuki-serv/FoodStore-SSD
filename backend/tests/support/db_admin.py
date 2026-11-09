"""Administración de bases de tests (crear si faltan). Solo para la suite."""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError


def ensure_database_exists(database_url: str) -> None:
    """Crea la base si falta, conectando a la base de mantenimiento `postgres` (AUTOCOMMIT)."""
    url = make_url(database_url)
    maintenance = create_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT", connect_args={"connect_timeout": 10}
    )
    try:
        with maintenance.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": url.database}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    except OperationalError as exc:
        pytest.exit(
            f"No se pudo conectar a PostgreSQL ({url.host}:{url.port}). ¿Está levantado "
            f"'docker compose up -d db' (desde la raíz del proyecto) y son correctas las credenciales de backend/tests/.env.test? "
            f"{exc}",
            returncode=2,
        )
    finally:
        maintenance.dispose()
