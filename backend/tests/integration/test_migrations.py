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
from app.modules.pedidos.models import DetallePedido
from app.modules.pedidos.models import EstadoPedido
from app.modules.pagos.models import FormaPago
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


def test_current_and_head_tras_upgrade_devuelve_007_en_ambas_posiciones(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert current_and_head(conn) == ("007", "007")


def test_current_and_head_sobre_base_vacia_devuelve_none_y_la_cabeza(migrations_db: Engine) -> None:
    with migrations_db.connect() as conn:
        assert current_and_head(conn) == (None, "007")


# ---------------------------------------------------------------------------
# La base de la suite (`foodstore_test`) sale de las migraciones
# ---------------------------------------------------------------------------
def test_foodstore_test_queda_en_head_al_iniciar_la_sesion(session: Session) -> None:
    actual, head = current_and_head(session.connection())

    assert actual == head == "007"


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


@pytest.mark.parametrize("motivo", ["LOGOUT", "LOGOUT_ALL", "REUSO", "BAJA"])
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
    assert version == ("007", "007")


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


# ---------------------------------------------------------------------------
# Migración 004: pagos con Orders API (C-12, D21)
# ---------------------------------------------------------------------------
_INSERTAR_PAGO_003 = text(
    "INSERT INTO pagos (pedido_id, estado, external_reference, idempotency_key, transaction_amount, "
    "mp_payment_id, mp_merchant_order_id, created_at, updated_at) "
    "VALUES (:p, 'pendiente', :r, :k, 10, :pay, :mer, now(), now())"
)
_INSERTAR_PAGO_004 = text(
    "INSERT INTO pagos (pedido_id, estado, external_reference, idempotency_key, transaction_amount, "
    "mp_order_id, mp_payment_id, created_at, updated_at) "
    "VALUES (:p, 'pendiente', :r, :k, 10, :ord, :pay, now(), now())"
)


def test_tras_upgrade_head_pagos_tiene_mp_order_id_unico_mp_payment_id_texto_y_sin_merchant_order(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        orden = conn.execute(text(_COLUMNAS_PAGOS), {"c": "mp_order_id"}).one()
        pago = conn.execute(text(_COLUMNAS_PAGOS), {"c": "mp_payment_id"}).one()
        restriccion = conn.execute(
            text("SELECT contype FROM pg_constraint WHERE conname = 'uq_pagos_mp_order_id'")
        ).scalar()
        nombres = {c["name"] for c in inspect(conn).get_columns("pagos")}
        version = current_and_head(conn)[0]

    assert tuple(orden) == ("character varying", 64, "YES")
    assert tuple(pago) == ("character varying", 64, "YES")
    assert restriccion == "u"
    assert "mp_merchant_order_id" not in nombres
    assert version == "007"


def test_upgrade_de_003_a_004_convierte_mp_payment_id_a_texto_y_descarta_la_merchant_order(
    migrations_db: Engine,
) -> None:
    _a_003(migrations_db)
    with migrations_db.begin() as conn:
        pedido_id = _pedido_crudo(conn)
        conn.execute(
            _INSERTAR_PAGO_003, {"p": pedido_id, "r": str(uuid4()), "k": "k-1", "pay": 123456, "mer": 999}
        )

    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        fila = conn.execute(
            text("SELECT mp_payment_id, mp_order_id, idempotency_key, estado, transaction_amount FROM pagos")
        ).one()
    assert tuple(fila) == ("123456", None, "k-1", "pendiente", 10)


def test_dos_pagos_con_el_mismo_mp_order_id_son_rechazados_y_dos_nulos_se_aceptan(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        pedido_id = _pedido_crudo(conn)
        for clave in ("k-n1", "k-n2"):  # dos sin orden: permitido
            conn.execute(
                _INSERTAR_PAGO_004, {"p": pedido_id, "r": str(uuid4()), "k": clave, "ord": None, "pay": None}
            )
        conn.execute(_INSERTAR_PAGO_004, {"p": pedido_id, "r": str(uuid4()), "k": "k-o1", "ord": "ORD01X", "pay": None})
        with pytest.raises(IntegrityError, match="uq_pagos_mp_order_id"):
            conn.execute(
                _INSERTAR_PAGO_004, {"p": pedido_id, "r": str(uuid4()), "k": "k-o2", "ord": "ORD01X", "pay": None}
            )


def test_downgrade_de_004_a_003_conserva_ids_numericos_anula_los_de_texto_y_restaura_merchant_order(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        pedido_id = _pedido_crudo(conn)
        conn.execute(_INSERTAR_PAGO_004, {"p": pedido_id, "r": str(uuid4()), "k": "k-t", "ord": "ORD01A", "pay": "PAY01ABC"})
        conn.execute(_INSERTAR_PAGO_004, {"p": pedido_id, "r": str(uuid4()), "k": "k-n", "ord": "ORD01B", "pay": "123456"})

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "003")

    with migrations_db.connect() as conn:
        filas = conn.execute(
            text("SELECT idempotency_key, mp_payment_id, mp_merchant_order_id FROM pagos ORDER BY id")
        ).all()
        columna = conn.execute(text(_COLUMNAS_PAGOS), {"c": "mp_payment_id"}).one()
        nombres = {c["name"] for c in inspect(conn).get_columns("pagos")}
        version = current_and_head(conn)[0]
    assert [tuple(f) for f in filas] == [("k-t", None, None), ("k-n", 123456, None)]
    assert columna[0] == "bigint"
    assert "mp_order_id" not in nombres
    assert version == "003"


def test_ida_y_vuelta_004_003_004_no_deja_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "003")
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []


# ---------------------------------------------------------------------------
# Migración 005: email de usuario normalizado (C-14, DU-4)
# ---------------------------------------------------------------------------
_INSERTAR_USUARIO_CRUDO = text(
    "INSERT INTO usuario (nombre, apellido, email, password_hash, created_at, updated_at, deleted_at) "
    "VALUES ('N', 'A', :email, :hash, now(), now(), :baja) RETURNING id"
)


def _a_004(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(build_alembic_config(conn), "004")


def _usuario_crudo(conn: Connection, email: str, *, baja: bool = False) -> int:
    return conn.execute(_INSERTAR_USUARIO_CRUDO, {"email": email, "hash": HASH, "baja": BAJA if baja else None}).scalar_one()


def _emails(engine: Engine) -> list[str]:
    with engine.connect() as conn:
        return [fila[0] for fila in conn.execute(text("SELECT email FROM usuario ORDER BY id"))]


def test_tras_upgrade_head_existen_el_check_de_email_normalizado_y_el_indice_unico_parcial(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        check = conn.execute(text("SELECT contype FROM pg_constraint WHERE conname = 'ck_usuario_email_normalizado'")).scalar()
        indice = conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = 'uq_usuario_email_activo'")).scalar()
        version = current_and_head(conn)[0]

    assert (check, indice, version) == ("c", 1, "007")


@pytest.mark.parametrize("email", ["Ana@x.com", " ana@x.com", "ana@X.com"])
def test_la_base_rechaza_un_email_sin_normalizar_insertado_directamente(migrations_db: Engine, email: str) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        with pytest.raises(IntegrityError, match="ck_usuario_email_normalizado"):
            _usuario_crudo(conn, email)


def test_upgrade_de_004_a_005_normaliza_los_emails_activos_y_dados_de_baja_sin_tocar_los_demas_datos(migrations_db: Engine) -> None:
    _a_004(migrations_db)
    with migrations_db.begin() as conn:
        _usuario_crudo(conn, "Ana@X.com")
        _usuario_crudo(conn, " Beto@x.com", baja=True)

    _migrar(migrations_db)

    assert _emails(migrations_db) == ["ana@x.com", "beto@x.com"]
    with migrations_db.connect() as conn:
        filas = conn.execute(text("SELECT nombre, apellido, password_hash, deleted_at IS NULL FROM usuario ORDER BY id")).all()
    assert [tuple(f) for f in filas] == [("N", "A", HASH, True), ("N", "A", HASH, False)]


def test_upgrade_con_dos_usuarios_activos_que_colisionan_falla_listando_email_e_ids_y_no_cambia_nada(migrations_db: Engine) -> None:
    _a_004(migrations_db)
    with migrations_db.begin() as conn:
        id_a = _usuario_crudo(conn, "Juan@x.com")
        id_b = _usuario_crudo(conn, "juan@x.com")

    with pytest.raises(RuntimeError, match="juan@x.com") as error:
        _migrar(migrations_db)

    assert str(id_a) in str(error.value) and str(id_b) in str(error.value)
    with migrations_db.connect() as conn:
        assert current_and_head(conn)[0] == "004"
    assert _emails(migrations_db) == ["Juan@x.com", "juan@x.com"]


def test_upgrade_con_un_activo_y_un_dado_de_baja_que_coinciden_termina_sin_errores(migrations_db: Engine) -> None:
    _a_004(migrations_db)
    with migrations_db.begin() as conn:
        _usuario_crudo(conn, "juan@x.com")
        _usuario_crudo(conn, "Juan@x.com", baja=True)

    _migrar(migrations_db)

    assert _emails(migrations_db) == ["juan@x.com", "juan@x.com"]


def test_downgrade_de_005_a_004_quita_el_check_y_conserva_los_emails_en_minusculas(migrations_db: Engine) -> None:
    _a_004(migrations_db)
    with migrations_db.begin() as conn:
        _usuario_crudo(conn, "Ana@X.com")
    _migrar(migrations_db)

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "004")

    with migrations_db.connect() as conn:
        check = conn.execute(text("SELECT 1 FROM pg_constraint WHERE conname = 'ck_usuario_email_normalizado'")).scalar()
        indice = conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = 'uq_usuario_email_activo'")).scalar()
        version = current_and_head(conn)[0]
    assert (check, indice, version) == (None, 1, "004")
    assert _emails(migrations_db) == ["ana@x.com"]


def test_ida_y_vuelta_005_004_005_no_deja_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "004")
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []


# ---------------------------------------------------------------------------
# Migración 006: motivo de cierre de sesión `BAJA` (C-23)
# ---------------------------------------------------------------------------
def _a_005(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(build_alembic_config(conn), "005")


def _motivos(engine: Engine) -> list[str]:
    with engine.connect() as conn:
        return [fila[0] for fila in conn.execute(text("SELECT revoked_reason FROM sesion ORDER BY created_at, id"))]


def test_en_005_el_motivo_baja_es_rechazado_y_tras_upgrade_a_006_es_aceptado(migrations_db: Engine) -> None:
    _a_005(migrations_db)
    usuario_id = _crear_usuario(migrations_db)
    with migrations_db.connect() as conn:
        with pytest.raises(IntegrityError, match="ck_sesion_revoked_reason"):
            _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="BAJA")

    _migrar(migrations_db)

    with migrations_db.begin() as conn:
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="BAJA")
    assert _motivos(migrations_db) == ["BAJA"]


def test_upgrade_de_005_a_006_conserva_las_sesiones_y_sus_motivos(migrations_db: Engine) -> None:
    _a_005(migrations_db)
    usuario_id = _crear_usuario(migrations_db)
    with migrations_db.begin() as conn:
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="LOGOUT")
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="REUSO")
        _insertar_sesion(conn, usuario_id)

    _migrar(migrations_db)

    assert sorted(m or "" for m in _motivos(migrations_db)) == ["", "LOGOUT", "REUSO"]


def test_downgrade_de_006_a_005_pasa_las_sesiones_baja_a_logout_all_y_vuelve_a_rechazar_baja(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)
    with migrations_db.begin() as conn:
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="BAJA")
        _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="LOGOUT")

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "005")

    assert sorted(_motivos(migrations_db)) == ["LOGOUT", "LOGOUT_ALL"]
    with migrations_db.connect() as conn:
        assert current_and_head(conn)[0] == "005"
        with pytest.raises(IntegrityError, match="ck_sesion_revoked_reason"):
            _insertar_sesion(conn, usuario_id, rev_at=BAJA, rev_reason="BAJA")


def test_ida_y_vuelta_006_005_006_no_deja_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "005")
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []


# ---------------------------------------------------------------------------
# Migración 007: una sola dirección principal activa por usuario (C-25b1, RN-DI-01)
# ---------------------------------------------------------------------------
def _a_006(engine: Engine) -> None:
    with engine.begin() as conn:
        command.upgrade(build_alembic_config(conn), "006")


def _insertar_direccion(conn: Connection, usuario_id: int, linea1: str, *, principal: bool, actualizada: str, baja: bool = False) -> int:
    return conn.execute(
        text(
            "INSERT INTO direccion_entrega (usuario_id, linea1, ciudad, es_principal, created_at, updated_at, deleted_at) "
            "VALUES (:u, :l, 'Mendoza', :p, :a, :a, :d) RETURNING id"
        ),
        {"u": usuario_id, "l": linea1, "p": principal, "a": actualizada, "d": actualizada if baja else None},
    ).scalar_one()


def _principales_activas(engine: Engine, usuario_id: int) -> list[str]:
    with engine.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT linea1 FROM direccion_entrega "
                "WHERE usuario_id = :u AND es_principal AND deleted_at IS NULL ORDER BY linea1"
            ),
            {"u": usuario_id},
        )
        return [fila[0] for fila in filas]


def test_upgrade_de_006_a_007_deja_una_sola_principal_la_de_updated_at_mas_reciente(migrations_db: Engine) -> None:
    _a_006(migrations_db)
    usuario_id = _crear_usuario(migrations_db)
    with migrations_db.begin() as conn:
        _insertar_direccion(conn, usuario_id, "Vieja", principal=True, actualizada="2026-01-01T00:00:00Z")
        _insertar_direccion(conn, usuario_id, "Nueva", principal=True, actualizada="2026-03-01T00:00:00Z")
        _insertar_direccion(conn, usuario_id, "Media", principal=True, actualizada="2026-02-01T00:00:00Z")
        _insertar_direccion(conn, usuario_id, "Comun", principal=False, actualizada="2026-01-01T00:00:00Z")

    _migrar(migrations_db)

    assert _principales_activas(migrations_db, usuario_id) == ["Nueva"]
    with migrations_db.connect() as conn:
        total = conn.execute(text("SELECT count(*) FROM direccion_entrega WHERE usuario_id = :u"), {"u": usuario_id}).scalar()
    assert total == 4


def test_upgrade_desempata_por_id_y_no_toca_a_otros_usuarios_ni_a_las_dadas_de_baja(migrations_db: Engine) -> None:
    _a_006(migrations_db)
    ana, beto = _crear_usuario(migrations_db, "ana@x.com"), _crear_usuario(migrations_db, "beto@x.com")
    with migrations_db.begin() as conn:
        _insertar_direccion(conn, ana, "A-primera", principal=True, actualizada="2026-01-01T00:00:00Z")
        _insertar_direccion(conn, ana, "A-segunda", principal=True, actualizada="2026-01-01T00:00:00Z")
        _insertar_direccion(conn, ana, "A-baja", principal=True, actualizada="2026-05-01T00:00:00Z", baja=True)
        _insertar_direccion(conn, beto, "B-unica", principal=True, actualizada="2026-01-01T00:00:00Z")

    _migrar(migrations_db)

    assert _principales_activas(migrations_db, ana) == ["A-segunda"]
    assert _principales_activas(migrations_db, beto) == ["B-unica"]
    with migrations_db.connect() as conn:
        baja_sigue_principal = conn.execute(
            text("SELECT es_principal FROM direccion_entrega WHERE linea1 = 'A-baja'")
        ).scalar()
    assert baja_sigue_principal is True


def test_tras_007_el_indice_es_unico_parcial_y_el_esquema_coincide_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        indexdef = conn.execute(
            text("SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_direccion_principal_activa'")
        ).scalar()
        diferencias = _diferencias(conn)

    assert indexdef is not None and "UNIQUE" in indexdef
    assert "es_principal" in indexdef and "deleted_at IS NULL" in indexdef
    assert diferencias == []


def test_downgrade_de_007_a_006_quita_el_indice_y_conserva_las_direcciones(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _crear_usuario(migrations_db)
    with migrations_db.begin() as conn:
        _insertar_direccion(conn, usuario_id, "Unica", principal=True, actualizada="2026-01-01T00:00:00Z")

    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "006")

    with migrations_db.begin() as conn:
        indice = conn.execute(text("SELECT 1 FROM pg_indexes WHERE indexname = 'uq_direccion_principal_activa'")).scalar()
        version = current_and_head(conn)[0]
        _insertar_direccion(conn, usuario_id, "Otra", principal=True, actualizada="2026-02-01T00:00:00Z")
    assert (indice, version) == (None, "006")
    assert _principales_activas(migrations_db, usuario_id) == ["Otra", "Unica"]


def test_ida_y_vuelta_007_006_007_no_deja_diferencias_con_los_modelos(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        command.downgrade(build_alembic_config(conn), "006")
    _migrar(migrations_db)

    with migrations_db.connect() as conn:
        assert _diferencias(conn) == []
