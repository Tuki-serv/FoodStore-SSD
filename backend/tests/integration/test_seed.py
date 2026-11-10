"""Contenido y comportamiento del seed (`python -m app.db.seed`) sobre la base auxiliar de migraciones.

Cada test migra la base vacía (`migrations_db`), prepara datos con SQL si hace falta, corre `seed` y consulta.
Los literales (códigos, órdenes, conteos) están escritos a mano: no se importan de las constantes del seed.
"""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import Engine

from app.core.security import verify_password
from app.db.migrations import upgrade_to_head
from app.db.seed import seed


def _migrar(engine: Engine) -> None:
    with engine.begin() as conn:
        upgrade_to_head(conn)


def _migrar_y_sembrar(engine: Engine) -> None:
    _migrar(engine)
    seed(engine)


def _filas(engine: Engine, sql: str) -> list[tuple]:
    with engine.connect() as conn:
        return [tuple(row) for row in conn.execute(text(sql))]


# --- 1. Catálogos canónicos sobre base nueva -------------------------------------------------------------------------


def test_seed_sobre_base_nueva_deja_los_seis_estados_con_su_orden_y_terminales(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    estados = _filas(migrations_db, "SELECT codigo, orden, es_terminal FROM estado_pedido ORDER BY orden")

    assert estados == [
        ("PENDIENTE", 1, False),
        ("CONFIRMADO", 2, False),
        ("EN_PREP", 3, False),
        ("EN_CAMINO", 4, False),
        ("ENTREGADO", 5, True),
        ("CANCELADO", 6, True),
    ]


def test_seed_sobre_base_nueva_deja_solo_las_tres_formas_de_pago_habilitadas(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    formas = _filas(migrations_db, "SELECT codigo, habilitado FROM forma_pago")

    assert set(formas) == {("MERCADOPAGO", True), ("EFECTIVO", True), ("TRANSFERENCIA", True)}
    assert len(formas) == 3


def test_seed_sobre_base_nueva_deja_exactamente_los_cuatro_roles_con_su_nombre(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    roles = _filas(migrations_db, "SELECT codigo, nombre FROM rol")

    assert set(roles) == {
        ("ADMIN", "Administrador"),
        ("STOCK", "Gestor de Stock"),
        ("PEDIDOS", "Gestor de Pedidos"),
        ("CLIENT", "Cliente"),
    }
    assert len(roles) == 4


# --- 2. Reconciliación de bases existentes ----------------------------------------------------------------------------


def _insertar_catalogo_de_estados_viejo(engine: Engine) -> None:
    """Los cinco estados del seed anterior: sin `EN_CAMINO` y con `CANCELADO` en orden 99."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO estado_pedido (codigo, descripcion, orden, es_terminal) VALUES "
                "('PENDIENTE', 'viejo', 1, false), ('CONFIRMADO', 'viejo', 2, false), "
                "('EN_PREP', 'viejo', 3, false), ('ENTREGADO', 'viejo', 5, true), ('CANCELADO', 'viejo', 99, true)"
            )
        )


def _insertar_usuario(engine: Engine, email: str) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text(
                "INSERT INTO usuario (nombre, apellido, email, password_hash, created_at, updated_at) "
                "VALUES ('Vieja', 'Base', :email, :hash, NOW(), NOW()) RETURNING id"
            ),
            {"email": email, "hash": "x" * 60},
        ).scalar_one()


def _insertar_pedido(engine: Engine, usuario_id: int, estado: str, forma_pago: str) -> int:
    with engine.begin() as conn:
        pedido_id = conn.execute(
            text(
                "INSERT INTO pedidos (usuario_id, estado_codigo, forma_pago_codigo, subtotal, descuento, "
                "costo_envio, total, created_at, updated_at) "
                "VALUES (:u, :e, :f, 100, 0, 0, 100, NOW(), NOW()) RETURNING id"
            ),
            {"u": usuario_id, "e": estado, "f": forma_pago},
        ).scalar_one()
        conn.execute(
            text(
                "INSERT INTO historial_estado_pedido (pedido_id, estado_desde, estado_hacia, created_at) "
                "VALUES (:p, NULL, :e, NOW())"
            ),
            {"p": pedido_id, "e": estado},
        )
    return pedido_id


def test_seed_sobre_catalogo_de_estados_viejo_lo_reconcilia_y_conserva_pedidos_e_historial(
    migrations_db: Engine,
) -> None:
    _migrar(migrations_db)
    _insertar_catalogo_de_estados_viejo(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(text("INSERT INTO forma_pago (codigo, descripcion, habilitado) VALUES ('EFECTIVO', 'x', true)"))
    usuario_id = _insertar_usuario(migrations_db, "vieja@base.com")
    pedido_id = _insertar_pedido(migrations_db, usuario_id, "CANCELADO", "EFECTIVO")
    historial_antes = _filas(migrations_db, "SELECT * FROM historial_estado_pedido ORDER BY id")

    seed(migrations_db)

    estados = _filas(migrations_db, "SELECT codigo, orden, es_terminal FROM estado_pedido ORDER BY orden")
    assert estados == [
        ("PENDIENTE", 1, False),
        ("CONFIRMADO", 2, False),
        ("EN_PREP", 3, False),
        ("EN_CAMINO", 4, False),
        ("ENTREGADO", 5, True),
        ("CANCELADO", 6, True),
    ]
    assert _filas(migrations_db, f"SELECT estado_codigo FROM pedidos WHERE id = {pedido_id}") == [("CANCELADO",)]
    assert _filas(migrations_db, "SELECT * FROM historial_estado_pedido ORDER BY id") == historial_antes


def test_seed_sobre_tarjeta_habilitada_con_un_pedido_la_deshabilita_sin_borrarla(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO estado_pedido (codigo, descripcion, orden, es_terminal) VALUES ('PENDIENTE', 'p', 1, false)"
            )
        )
        conn.execute(text("INSERT INTO forma_pago (codigo, descripcion, habilitado) VALUES ('TARJETA', 'Tarjeta', true)"))
    usuario_id = _insertar_usuario(migrations_db, "tarjeta@base.com")
    pedido_id = _insertar_pedido(migrations_db, usuario_id, "PENDIENTE", "TARJETA")

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT codigo, habilitado FROM forma_pago WHERE codigo = 'TARJETA'") == [
        ("TARJETA", False)
    ]
    assert _filas(migrations_db, f"SELECT forma_pago_codigo FROM pedidos WHERE id = {pedido_id}") == [("TARJETA",)]


def test_seed_respeta_efectivo_deshabilitado(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(text("INSERT INTO forma_pago (codigo, descripcion, habilitado) VALUES ('EFECTIVO', 'x', false)"))

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT habilitado FROM forma_pago WHERE codigo = 'EFECTIVO'") == [(False,)]


def test_seed_no_toca_el_rol_cocina_ni_su_asignacion(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    usuario_id = _insertar_usuario(migrations_db, "cocina@base.com")
    with migrations_db.begin() as conn:
        conn.execute(text("INSERT INTO rol (codigo, nombre, descripcion) VALUES ('COCINA', 'Cocina', 'Cocina a mano')"))
        conn.execute(
            text("INSERT INTO usuario_rol (usuario_id, rol_codigo, created_at) VALUES (:u, 'COCINA', NOW())"),
            {"u": usuario_id},
        )
    roles_antes = _filas(migrations_db, "SELECT * FROM rol WHERE codigo = 'COCINA'")
    asignacion_antes = _filas(migrations_db, "SELECT * FROM usuario_rol WHERE rol_codigo = 'COCINA'")

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT * FROM rol WHERE codigo = 'COCINA'") == roles_antes
    assert _filas(migrations_db, "SELECT * FROM usuario_rol WHERE rol_codigo = 'COCINA'") == asignacion_antes
    assert len(asignacion_antes) == 1


def test_seed_corrige_la_descripcion_de_un_rol_del_catalogo_editada_a_mano(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(text("INSERT INTO rol (codigo, nombre, descripcion) VALUES ('CLIENT', 'Cliente', 'editada a mano')"))

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT descripcion FROM rol WHERE codigo = 'CLIENT'") == [
        ("Opera solo sus propios datos",)
    ]


# --- 3. Administrador inicial -----------------------------------------------------------------------------------------


def test_seed_sobre_base_nueva_crea_el_admin_con_rol_admin_y_la_contrasena_de_la_spec(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    admins = _filas(
        migrations_db,
        "SELECT id, password_hash FROM usuario WHERE email = 'admin@foodstore.com' AND deleted_at IS NULL",
    )
    assert len(admins) == 1
    admin_id, password_hash = admins[0]
    assert _filas(migrations_db, f"SELECT rol_codigo FROM usuario_rol WHERE usuario_id = {admin_id}") == [("ADMIN",)]
    assert verify_password("Admin1234!", password_hash) is True
    assert verify_password("admin123", password_hash) is False


def test_seed_con_admin_existente_no_cambia_su_hash_ni_sus_roles_y_no_crea_otro(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    admin_id = _insertar_usuario(migrations_db, "admin@foodstore.com")
    hash_original = "x" * 60

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT id, password_hash FROM usuario WHERE email = 'admin@foodstore.com'") == [
        (admin_id, hash_original)
    ]
    assert _filas(migrations_db, f"SELECT * FROM usuario_rol WHERE usuario_id = {admin_id}") == []


def test_seed_con_admin_dado_de_baja_no_crea_otro_ni_lo_modifica(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    admin_id = _insertar_usuario(migrations_db, "admin@foodstore.com")
    with migrations_db.begin() as conn:
        conn.execute(text(f"UPDATE usuario SET deleted_at = NOW() WHERE id = {admin_id}"))
    antes = _filas(migrations_db, "SELECT * FROM usuario WHERE email = 'admin@foodstore.com'")

    seed(migrations_db)

    assert _filas(migrations_db, "SELECT * FROM usuario WHERE email = 'admin@foodstore.com'") == antes


# --- 4. Datos de demostración idempotentes ----------------------------------------------------------------------------


def test_seed_dos_corridas_seguidas_la_segunda_termina_sin_error(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    seed(migrations_db)  # no debe lanzar (hoy: IntegrityError en uq_categorias_nombre_activo)


def test_seed_sobre_base_nueva_crea_los_datos_de_demostracion_con_sus_relaciones(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)

    roles_de_prueba = _filas(
        migrations_db,
        "SELECT u.email, ur.rol_codigo FROM usuario u JOIN usuario_rol ur ON ur.usuario_id = u.id "
        "WHERE u.email <> 'admin@foodstore.com' ORDER BY u.email",
    )
    assert roles_de_prueba == [
        ("cliente@foodstore.com", "CLIENT"),
        ("pedidos@foodstore.com", "PEDIDOS"),
        ("stock@foodstore.com", "STOCK"),
    ]
    conteos = {
        tabla: _filas(migrations_db, f"SELECT COUNT(*) FROM {tabla}")[0][0]
        for tabla in (
            "unidades_medida", "categorias", "ingredientes", "productos", "producto_categoria", "producto_ingrediente"
        )
    }
    assert conteos == {
        "unidades_medida": 7,
        "categorias": 6,
        "ingredientes": 12,
        "productos": 6,
        "producto_categoria": 9,
        "producto_ingrediente": 22,
    }
    assert _filas(migrations_db, "SELECT COUNT(*) FROM categorias WHERE parent_id IS NOT NULL") == [(3,)]


def test_seed_no_recrea_un_producto_de_demo_dado_de_baja(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(text("UPDATE productos SET deleted_at = NOW() WHERE nombre = 'Hamburguesa Clásica'"))

    seed(migrations_db)

    assert _filas(
        migrations_db, "SELECT COUNT(*) FROM productos WHERE nombre = 'Hamburguesa Clásica' AND deleted_at IS NULL"
    ) == [(0,)]
    assert _filas(migrations_db, "SELECT COUNT(*) FROM productos") == [(6,)]


# --- 5. Idempotencia y atomicidad -------------------------------------------------------------------------------------

_TABLAS_QUE_SIEMBRA_EL_SEED: dict[str, str] = {  # tabla -> columnas de la PK
    "rol": "codigo",
    "estado_pedido": "codigo",
    "forma_pago": "codigo",
    "usuario": "id",
    "usuario_rol": "usuario_id, rol_codigo",
    "unidades_medida": "id",
    "categorias": "id",
    "ingredientes": "id",
    "productos": "id",
    "producto_categoria": "producto_id, categoria_id",
    "producto_ingrediente": "producto_id, ingrediente_id",
}


def _foto(engine: Engine) -> dict[str, list[tuple]]:
    """Todas las columnas de las tablas que escribe el seed, ordenadas por PK (incluye auditoría y hashes)."""
    return {
        tabla: _filas(engine, f"SELECT * FROM {tabla} ORDER BY {pk}")
        for tabla, pk in _TABLAS_QUE_SIEMBRA_EL_SEED.items()
    }


def test_seed_dos_corridas_seguidas_dejan_las_tablas_identicas(migrations_db: Engine) -> None:
    _migrar_y_sembrar(migrations_db)
    foto_primera = _foto(migrations_db)
    assert foto_primera["productos"], "la primera corrida debe haber sembrado datos"

    seed(migrations_db)

    assert _foto(migrations_db) == foto_primera


def test_seed_sobre_base_reconciliada_la_corrida_siguiente_no_cambia_ninguna_fila(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    _insertar_catalogo_de_estados_viejo(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(text("INSERT INTO forma_pago (codigo, descripcion, habilitado) VALUES ('TARJETA', 'Tarjeta', true)"))
    seed(migrations_db)  # reconcilia
    foto_reconciliada = _foto(migrations_db)

    seed(migrations_db)

    assert _foto(migrations_db) == foto_reconciliada


def test_seed_que_falla_a_mitad_de_corrida_deja_la_base_como_estaba(migrations_db: Engine) -> None:
    _migrar(migrations_db)
    with migrations_db.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO unidades_medida (nombre, simbolo, tipo, created_at, updated_at) "
                "VALUES ('Kilogramo', 'KGX', 'peso', NOW(), NOW())"
            )
        )

    with pytest.raises(IntegrityError):
        seed(migrations_db)

    for tabla in ("rol", "estado_pedido", "forma_pago", "usuario"):
        assert _filas(migrations_db, f"SELECT COUNT(*) FROM {tabla}") == [(0,)], tabla
    assert _filas(migrations_db, "SELECT nombre, simbolo FROM unidades_medida") == [("Kilogramo", "KGX")]
