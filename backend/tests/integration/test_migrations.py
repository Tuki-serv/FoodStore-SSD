"""Migraciones sobre la base auxiliar `foodstore_migrations_test` (upgrade, downgrade, esquema == modelos)."""
from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import Column, Integer, MetaData, inspect, text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.db.migrations import build_alembic_config, current_and_head, upgrade_to_head
from app.db.models import import_all_models
from app.modules.detalles_pedido.models import DetallePedido
from app.modules.estados_pedido.models import EstadoPedido
from app.modules.formas_pago.models import FormaPago
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from app.modules.unidades_medida.models import UnidadMedida
from app.modules.usuarios.models import Usuario
from tests.support.schema_expectations import (
    COLUMNAS_DE_FECHA_ESPERADAS,
    FK_A_USUARIO_ESPERADAS,
    INDICES_UNICOS_PARCIALES,
    TABLAS_ESPERADAS,
)

pytestmark = pytest.mark.slow

BAJA = datetime(2026, 1, 1, tzinfo=timezone.utc)
HASH = "x" * 60


def _diferencias(conn: Connection, metadata: MetaData | None = None) -> list:
    context = MigrationContext.configure(conn, opts={"compare_type": True, "compare_server_default": True})
    return compare_metadata(context, metadata if metadata is not None else import_all_models())


def _migrar(engine: Engine) -> None:
    with engine.begin() as conn:
        upgrade_to_head(conn)


def _downgrade_a_base(engine: Engine) -> None:
    with engine.begin() as conn:
        command.downgrade(build_alembic_config(conn), "base")


def _tablas(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(inspect(conn).get_table_names())


def _usuario(email: str, **extra) -> Usuario:
    return Usuario(nombre="N", apellido="A", email=email, password_hash=HASH, **extra)


# ---------------------------------------------------------------------------
# Esquema == modelos
# ---------------------------------------------------------------------------
def test_esquema_migrado_sobre_base_vacia_coincide_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []


def test_modelo_con_columna_extra_sin_migracion_se_informa_como_diferencia(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    modificada = MetaData()
    for tabla in import_all_models().tables.values():
        tabla.to_metadata(modificada)
    modificada.tables["rol"].append_column(Column("columna_nueva", Integer))

    with migrations_db.connect() as conn:
        diferencias = _diferencias(conn, modificada)

    assert any(d[0] == "add_column" and d[3].name == "columna_nueva" for d in diferencias)


# ---------------------------------------------------------------------------
# Contenido de la migración 001
# ---------------------------------------------------------------------------
def test_upgrade_crea_exactamente_las_17_tablas_mas_alembic_version(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    assert _tablas(migrations_db) == set(TABLAS_ESPERADAS) | {"alembic_version"}


@pytest.mark.parametrize("indice", INDICES_UNICOS_PARCIALES)
def test_indices_unicos_parciales_existen_con_unique_y_where_deleted_at_is_null(
    migrations_db: Engine, indice: str
) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        indexdef = conn.execute(text("SELECT indexdef FROM pg_indexes WHERE indexname = :n"), {"n": indice}).scalar()

    assert indexdef is not None
    assert "UNIQUE" in indexdef
    assert "WHERE (deleted_at IS NULL)" in indexdef


def test_usuarios_con_mismo_email_uno_eliminado_se_aceptan_y_dos_activos_se_rechazan(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with Session(migrations_db) as session:
        session.add(_usuario("a@x.com", deleted_at=BAJA))
        session.add(_usuario("a@x.com"))
        session.commit()

        session.add(_usuario("a@x.com"))
        with pytest.raises(IntegrityError, match="uq_usuario_email_activo"):
            session.commit()


def test_unidades_de_medida_reutilizan_nombre_y_simbolo_de_una_eliminada(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with Session(migrations_db) as session:
        session.add(UnidadMedida(nombre="Gramo", simbolo="g", tipo="peso", deleted_at=BAJA))
        session.add(UnidadMedida(nombre="Gramo", simbolo="g", tipo="peso"))
        session.commit()

        session.add(UnidadMedida(nombre="Otro", simbolo="g", tipo="peso"))
        with pytest.raises(IntegrityError, match="uq_unidades_medida_simbolo_activo"):
            session.commit()


def test_detalle_pedido_guarda_y_lee_los_arrays_de_personalizacion_en_orden(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with Session(migrations_db) as session:
        usuario = _usuario("arr@x.com")
        producto = Producto(nombre="Burger", precio_base="10.00")
        session.add_all(
            [
                usuario,
                producto,
                EstadoPedido(codigo="PENDIENTE", descripcion="Pendiente", orden=1, es_terminal=False),
                FormaPago(codigo="EFECTIVO", descripcion="Efectivo", habilitado=True),
            ]
        )
        session.flush()
        pedido = Pedido(
            usuario_id=usuario.id,
            estado_codigo="PENDIENTE",
            forma_pago_codigo="EFECTIVO",
            subtotal="10.00",
            total="10.00",
            costo_envio="0.00",
            descuento="0.00",
        )
        session.add(pedido)
        session.flush()
        detalle = DetallePedido(
            pedido_id=pedido.id,
            producto_id=producto.id,
            cantidad=1,
            precio_snapshot="10.00",
            subtotal_snapshot="10.00",
            nombre_snapshot="Burger",
            personalizacion=[3, 7],
            personalizacion_snapshot=["Cebolla", "Tomate"],
        )
        session.add(detalle)
        session.commit()
        detalle_id = detalle.id
        session.expire_all()

        leido = session.get(DetallePedido, detalle_id)

    assert leido is not None
    assert leido.personalizacion == [3, 7]
    assert leido.personalizacion_snapshot == ["Cebolla", "Tomate"]


def test_las_32_columnas_de_fecha_son_timestamptz_y_no_hay_ninguna_sin_zona(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT table_name || '.' || column_name, data_type FROM information_schema.columns "
                "WHERE table_schema = 'public' AND data_type LIKE 'timestamp%'"
            )
        ).all()

    con_zona = {nombre for nombre, tipo in filas if tipo == "timestamp with time zone"}
    sin_zona = [nombre for nombre, tipo in filas if tipo == "timestamp without time zone"]
    assert sin_zona == []
    assert con_zona == set(COLUMNAS_DE_FECHA_ESPERADAS)


def test_usuario_id_sus_seis_fk_son_bigint_y_linea1_es_text(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    consulta = text(
        "SELECT data_type FROM information_schema.columns "
        "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
    )

    with migrations_db.connect() as conn:
        tipos = {
            ref: conn.execute(consulta, dict(zip(("t", "c"), ref.split(".")))).scalar()
            for ref in {"usuario.id", *FK_A_USUARIO_ESPERADAS}
        }
        linea1 = conn.execute(consulta, {"t": "direccion_entrega", "c": "linea1"}).scalar()

    assert len(tipos) == 7
    assert set(tipos.values()) == {"bigint"}
    assert linea1 == "text"


def test_check_de_stock_existe_y_la_fk_de_parent_id_es_on_delete_set_null(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        check = conn.execute(
            text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'ck_producto_stock_no_negativo'")
        ).scalar()
        confdeltype = conn.execute(
            text(
                "SELECT confdeltype FROM pg_constraint WHERE contype = 'f' "
                "AND conrelid = 'categorias'::regclass AND confrelid = 'categorias'::regclass"
            )
        ).scalar()

    assert check == "CHECK ((stock_cantidad >= 0))"
    assert confdeltype == "n"


def test_pagos_external_reference_sigue_varchar_100_nullable_y_sin_unicidad(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        columna = conn.execute(
            text(
                "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns "
                "WHERE table_name = 'pagos' AND column_name = 'external_reference'"
            )
        ).one()
        indices = conn.execute(
            text("SELECT indexdef FROM pg_indexes WHERE tablename = 'pagos' AND indexdef LIKE '%external_reference%'")
        ).all()

    assert tuple(columna) == ("character varying", 100, "YES")
    assert indices == []


# ---------------------------------------------------------------------------
# Reversibilidad y versión
# ---------------------------------------------------------------------------
def test_downgrade_a_base_deja_solo_alembic_version_vacia(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    _downgrade_a_base(migrations_db)

    assert _tablas(migrations_db) == {"alembic_version"}
    with migrations_db.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM alembic_version")).scalar() == 0


def test_ida_y_vuelta_termina_en_head_y_sin_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    _downgrade_a_base(migrations_db)
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        actual, head = current_and_head(conn)
        assert actual == head
        assert _diferencias(conn) == []


def test_current_and_head_tras_upgrade_devuelve_001_en_ambas_posiciones(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert current_and_head(conn) == ("001", "001")


def test_current_and_head_sobre_base_vacia_devuelve_none_y_la_cabeza(migrations_db: Engine) -> None:
    with migrations_db.connect() as conn:
        assert current_and_head(conn) == (None, "001")


# ---------------------------------------------------------------------------
# La base de la suite (`foodstore_test`) sale de las migraciones
# ---------------------------------------------------------------------------
def test_foodstore_test_queda_en_head_al_iniciar_la_sesion(session: Session) -> None:
    actual, head = current_and_head(session.connection())

    assert actual == head == "001"
