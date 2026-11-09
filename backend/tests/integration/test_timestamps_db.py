"""Fechas UTC con zona contra PostgreSQL real (D11)."""
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.core.config import settings
from app.core.database import build_engine
from app.modules.productos.models import Producto


def test_producto_creado_sin_created_at_se_relee_con_zona_utc(session: Session) -> None:
    producto = Producto(nombre="Zona Test", precio_base="10.00")
    session.add(producto)
    session.flush()
    producto_id = producto.id

    session.expire_all()
    releido = session.get(Producto, producto_id)

    assert releido is not None
    assert releido.created_at.utcoffset() == timedelta(0)
    assert releido.updated_at.utcoffset() == timedelta(0)


def test_producto_campo_nullable_deleted_at_queda_none_al_crear(session: Session) -> None:
    producto = Producto(nombre="Activo Test", precio_base="10.00")
    session.add(producto)
    session.flush()
    producto_id = producto.id

    session.expire_all()
    releido = session.get(Producto, producto_id)

    assert releido is not None
    assert releido.deleted_at is None


def test_sesion_del_engine_usa_utc_aunque_la_base_este_en_otra_zona(migrations_db: Engine) -> None:
    url = str(migrations_db.url.render_as_string(hide_password=False))
    db_name = migrations_db.url.database
    admin = build_engine(settings.model_copy(update={"DATABASE_URL": url}))
    try:
        with admin.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f'ALTER DATABASE "{db_name}" SET timezone TO \'America/Argentina/Buenos_Aires\''))
        fresh = build_engine(settings.model_copy(update={"DATABASE_URL": url}))
        try:
            with fresh.connect() as conn:
                zona = conn.execute(text("SHOW timezone")).scalar()
                dia = conn.execute(text("SELECT date(TIMESTAMPTZ '2026-11-10 01:30:00+00')")).scalar()
        finally:
            fresh.dispose()
    finally:
        with admin.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f'ALTER DATABASE "{db_name}" RESET timezone'))
        admin.dispose()

    assert zona == "UTC"
    assert str(dia) == "2026-11-10"
