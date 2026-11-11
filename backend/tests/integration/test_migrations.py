"""Migraciones sobre la base auxiliar `foodstore_migrations_test` (upgrade, downgrade, esquema == modelos)."""
from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from uuid import uuid4

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
def test_upgrade_crea_exactamente_las_18_tablas_mas_alembic_version(migrations_db: Engine) -> None:
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


def test_las_34_columnas_de_fecha_son_timestamptz_y_no_hay_ninguna_sin_zona(migrations_db: Engine) -> None:
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


def test_current_and_head_tras_upgrade_devuelve_003_en_ambas_posiciones(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert current_and_head(conn) == ("003", "003")


def test_current_and_head_sobre_base_vacia_devuelve_none_y_la_cabeza(migrations_db: Engine) -> None:
    with migrations_db.connect() as conn:
        assert current_and_head(conn) == (None, "003")


# ---------------------------------------------------------------------------
# La base de la suite (`foodstore_test`) sale de las migraciones
# ---------------------------------------------------------------------------
def test_foodstore_test_queda_en_head_al_iniciar_la_sesion(session: Session) -> None:
    actual, head = current_and_head(session.connection())

    assert actual == head == "003"


# ---------------------------------------------------------------------------
# Migración 002: sesiones y refresh rotado
# ---------------------------------------------------------------------------
def _insertar_sesion(conn: Connection, usuario_id: int, **extra) -> str:
    sid = str(uuid4())
    valores = {"id": sid, "u": usuario_id, "exp": datetime(2030, 1, 1, tzinfo=timezone.utc), "ahora": BAJA, **extra}
    conn.execute(
        text(
            "INSERT INTO sesion (id, usuario_id, expires_at, created_at, revoked_at, revoked_reason) "
            "VALUES (:id, :u, :exp, :ahora, :rev_at, :rev_reason)"
        ),
        {"rev_at": None, "rev_reason": None, **valores},
    )
    return sid


def _insertar_refresh(conn: Connection, sesion_id: str, token_hash: str, revoked_at: datetime | None = None) -> None:
    conn.execute(
        text(
            "INSERT INTO refresh_token (sesion_id, token_hash, revoked_at, created_at) "
            "VALUES (:s, :h, :r, :c)"
        ),
        {"s": sesion_id, "h": token_hash, "r": revoked_at, "c": BAJA},
    )


def _crear_usuario(engine: Engine, email: str = "m@x.com") -> int:
    with Session(engine) as session:
        usuario = _usuario(email)
        session.add(usuario)
        session.commit()
        return usuario.id


def test_tras_upgrade_refresh_token_tiene_sesion_id_uuid_y_no_tiene_expires_at_ni_usuario_id(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        columnas = dict(
            conn.execute(
                text(
                    "SELECT column_name, data_type FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'refresh_token'"
                )
            ).all()
        )

    assert columnas["sesion_id"] == "uuid"
    assert "expires_at" not in columnas
    assert "usuario_id" not in columnas


def test_ck_sesion_revoked_reason_rechaza_un_motivo_fuera_de_la_lista(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.connect() as conn:
        with pytest.raises(IntegrityError, match="ck_sesion_revoked_reason"):
            _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="OTRO")


@pytest.mark.parametrize("motivo", ["LOGOUT", "LOGOUT_ALL", "REUSO"])
def test_ck_sesion_revoked_reason_acepta_cada_motivo_valido(migrations_db: Engine, motivo: str) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.begin() as conn:
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason=motivo)
        cantidad = conn.execute(text("SELECT count(*) FROM sesion WHERE revoked_reason = :m"), {"m": motivo}).scalar()

    assert cantidad == 1


def test_ck_sesion_revocacion_consistente_rechaza_revoked_at_sin_motivo(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.connect() as conn:
        with pytest.raises(IntegrityError, match="ck_sesion_revocacion_consistente"):
            _insertar_sesion(conn, usuario_id, rev_at=BAJA)


def test_ck_sesion_revocacion_consistente_rechaza_motivo_sin_revoked_at(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.connect() as conn:
        with pytest.raises(IntegrityError, match="ck_sesion_revocacion_consistente"):
            _insertar_sesion(conn, usuario_id, rev_reason="LOGOUT")


def test_un_segundo_refresh_activo_en_la_misma_sesion_es_rechazado(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.connect() as conn:
        sesion_id = _insertar_sesion(conn, usuario_id)
        _insertar_refresh(conn, sesion_id, "a" * 64)
        with pytest.raises(IntegrityError, match="uq_refresh_token_sesion_activo"):
            _insertar_refresh(conn, sesion_id, "b" * 64)


def test_un_refresh_rotado_mas_uno_activo_en_la_misma_sesion_se_aceptan(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)

    with migrations_db.begin() as conn:
        sesion_id = _insertar_sesion(conn, usuario_id)
        _insertar_refresh(conn, sesion_id, "a" * 64, revoked_at=BAJA)
        _insertar_refresh(conn, sesion_id, "b" * 64)
        cantidad = conn.execute(text("SELECT count(*) FROM refresh_token")).scalar()

    assert cantidad == 2


def test_upgrade_de_001_a_002_con_un_refresh_existente_termina_sin_errores_y_vacia_refresh_token(
    migrations_db: Engine,
) -> None:
    with migrations_db.begin() as conn:
        command.upgrade(build_alembic_config(conn), "001")
        conn.execute(
            text(
                "INSERT INTO usuario (nombre, apellido, email, password_hash, created_at, updated_at) "
                "VALUES ('N', 'A', 'v@x.com', :h, now(), now())"
            ),
            {"h": HASH},
        )
        conn.execute(
            text(
                "INSERT INTO refresh_token (usuario_id, token_hash, expires_at, created_at) "
                "SELECT id, :t, now() + interval '7 days', now() FROM usuario WHERE email = 'v@x.com'"
            ),
            {"t": "c" * 64},
        )

    with migrations_db.begin() as conn:
        command.upgrade(build_alembic_config(conn), "002")

    with migrations_db.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM refresh_token")).scalar() == 0
        assert conn.execute(text("SELECT count(*) FROM usuario WHERE email = 'v@x.com'")).scalar() == 1
        assert current_and_head(conn)[0] == "002"


def test_downgrade_de_002_a_001_deja_el_esquema_de_la_001(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "001")

    assert "sesion" not in _tablas(migrations_db)
    with migrations_db.connect() as conn:
        columnas = {c["name"] for c in inspect(conn).get_columns("refresh_token")}
        assert columnas == {"id", "usuario_id", "token_hash", "expires_at", "revoked_at", "created_at"}
        assert current_and_head(conn)[0] == "001"


# ---------------------------------------------------------------------------
# Migración 003: pagos con Checkout API (C-12)
# ---------------------------------------------------------------------------
_COLUMNAS_PAGOS = (
    "SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns "
    "WHERE table_schema = 'public' AND table_name = 'pagos' AND column_name = :c"
)


def _a_002(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(build_alembic_config(conn), "002")


def _a_003(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(build_alembic_config(conn), "003")


def _pedido_crudo(conn: Connection) -> int:
    """Pedido mínimo por SQL (sin modelos: el esquema puede estar en la 002)."""
    conn.execute(
        text(
            "INSERT INTO usuario (nombre, apellido, email, password_hash, created_at, updated_at) "
            "VALUES ('N', 'A', 'p@x.com', :h, now(), now()) ON CONFLICT DO NOTHING"
        ),
        {"h": HASH},
    )
    conn.execute(
        text(
            "INSERT INTO estado_pedido (codigo, descripcion, orden, es_terminal) "
            "VALUES ('PENDIENTE', 'Pendiente', 1, false) ON CONFLICT DO NOTHING"
        )
    )
    conn.execute(
        text(
            "INSERT INTO forma_pago (codigo, descripcion, habilitado) "
            "VALUES ('MERCADOPAGO', 'MP', true) ON CONFLICT DO NOTHING"
        )
    )
    return conn.execute(
        text(
            "INSERT INTO pedidos (usuario_id, estado_codigo, forma_pago_codigo, subtotal, total, costo_envio, "
            "descuento, created_at, updated_at) SELECT id, 'PENDIENTE', 'MERCADOPAGO', 10, 10, 0, 0, now(), now() "
            "FROM usuario WHERE email = 'p@x.com' RETURNING id"
        )
    ).scalar_one()


def test_tras_upgrade_head_external_reference_es_uuid_not_null_unico_y_sin_columnas_de_preferencia(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        columna = conn.execute(text(_COLUMNAS_PAGOS), {"c": "external_reference"}).one()
        restriccion = conn.execute(
            text("SELECT contype FROM pg_constraint WHERE conname = 'uq_pagos_external_reference'")
        ).scalar()
        nombres = {c["name"] for c in inspect(conn).get_columns("pagos")}
        version = current_and_head(conn)

    assert (columna[0], columna[2]) == ("uuid", "NO")
    assert restriccion == "u"
    assert not {"mp_preference_id", "mp_init_point"} & nombres
    assert version == ("003", "003")


def test_dos_pagos_con_la_misma_external_reference_son_rechazados_por_la_restriccion_unica(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)
    ref = str(uuid4())
    insertar = text(
        "INSERT INTO pagos (pedido_id, estado, external_reference, idempotency_key, transaction_amount, "
        "created_at, updated_at) VALUES (:p, 'pendiente', :r, :k, 10, now(), now())"
    )

    with migrations_db.connect() as conn:
        pedido_id = _pedido_crudo(conn)
        conn.execute(insertar, {"p": pedido_id, "r": ref, "k": "k-1"})
        with pytest.raises(IntegrityError, match="uq_pagos_external_reference"):
            conn.execute(insertar, {"p": pedido_id, "r": ref, "k": "k-2"})


def test_pagos_sin_external_reference_son_rechazados_por_not_null(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        pedido_id = _pedido_crudo(conn)
        with pytest.raises(IntegrityError, match="external_reference"):
            conn.execute(
                text(
                    "INSERT INTO pagos (pedido_id, estado, idempotency_key, transaction_amount, created_at, "
                    "updated_at) VALUES (:p, 'pendiente', 'k-n', 10, now(), now())"
                ),
                {"p": pedido_id},
            )


def test_upgrade_de_002_a_003_da_un_uuid_distinto_a_cada_pago_y_conserva_el_resto(migrations_db: Engine) -> None:
    _a_002(migrations_db)
    with migrations_db.begin() as conn:
        pedido_id = _pedido_crudo(conn)
        for clave, ref in (("k-a", "42"), ("k-b", None)):
            conn.execute(
                text(
                    "INSERT INTO pagos (pedido_id, estado, external_reference, idempotency_key, transaction_amount, "
                    "mp_preference_id, created_at, updated_at) VALUES (:p, 'pendiente', :r, :k, 10, 'pref', now(), now())"
                ),
                {"p": pedido_id, "r": ref, "k": clave},
            )

    _a_003(migrations_db)

    with migrations_db.connect() as conn:
        filas = conn.execute(
            text("SELECT idempotency_key, external_reference::text, estado, transaction_amount FROM pagos ORDER BY id")
        ).all()
    assert [f[0] for f in filas] == ["k-a", "k-b"]
    referencias = [f[1] for f in filas]
    assert len(set(referencias)) == 2
    assert all(len(r) == 36 and r != "42" for r in referencias)
    assert all(f[2] == "pendiente" and f[3] == 10 for f in filas)


def test_downgrade_de_003_a_002_restaura_varchar_nullable_sin_unica_y_las_columnas_de_preferencia(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        pedido_id = _pedido_crudo(conn)
        conn.execute(
            text(
                "INSERT INTO pagos (pedido_id, estado, external_reference, idempotency_key, transaction_amount, "
                "created_at, updated_at) VALUES (:p, 'pendiente', :r, 'k-d', 10, now(), now())"
            ),
            {"p": pedido_id, "r": str(uuid4())},
        )

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "002")

    with migrations_db.connect() as conn:
        columna = conn.execute(text(_COLUMNAS_PAGOS), {"c": "external_reference"}).one()
        existe = conn.execute(
            text("SELECT count(*) FROM pg_constraint WHERE conname = 'uq_pagos_external_reference'")
        ).scalar()
        preferencias = conn.execute(text("SELECT mp_preference_id, mp_init_point FROM pagos")).one()
        version = current_and_head(conn)[0]
    assert tuple(columna) == ("character varying", 100, "YES")
    assert existe == 0
    assert tuple(preferencias) == (None, None)
    assert version == "002"


def test_ida_y_vuelta_003_002_003_no_deja_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "002")
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []
