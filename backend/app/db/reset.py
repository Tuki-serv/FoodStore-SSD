"""Reset de la base de desarrollo: borra todas las tablas (incluida `alembic_version`). Ejecutar: python -m app.db.reset"""
from sqlalchemy.engine import Engine

from app.core.database import engine as app_engine
from app.db.migrations import drop_all_tables


def nuke_database(engine: Engine | None = None) -> None:
    """Borra por reflexión todo lo que haya en la base, para volver a construirla con `alembic upgrade head`."""
    with (engine or app_engine).begin() as conn:
        drop_all_tables(conn)
    print("[OK] Tuki-Base de datos reseteada.")


if __name__ == "__main__":
    nuke_database()
