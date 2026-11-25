"""Ventas de demostración que siembra `python -m app.db.seed` sobre la base auxiliar de migraciones.

Cada test migra la base vacía (`migrations_db`), corre `seed` y consulta con SQL. Los literales (conteos, estados, prefijos)
están escritos a mano: no se importan de las constantes del seed.
"""
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.migrations import upgrade_to_head
from app.db.seed import seed


def _migrar(engine: Engine) -> None:
    with engine.begin() as conn:
        upgrade_to_head(conn)


def _filas(engine: Engine, sql: str) -> list[tuple]:
    with engine.connect() as conn:
        return [tuple(row) for row in conn.execute(text(sql))]


def _sembrar(engine: Engine, **opciones: bool) -> tuple[datetime, datetime]:
    """Migra, corre el seed y devuelve el instante antes y después de la corrida."""
    _migrar(engine)
    antes = datetime.now(timezone.utc)
    seed(engine, **opciones)
    return antes, datetime.now(timezone.utc)


# --- 4.1 Ventas sobre base vacía ---------------------------------------------------------------------------------------


def test_seed_sobre_base_nueva_siembra_entre_250_y_350_pedidos_de_clientes_sin_pasar_del_fin_de_la_corrida(
    migrations_db: Engine,
) -> None:
    _, despues = _sembrar(migrations_db)

    total = _filas(migrations_db, "SELECT COUNT(*) FROM pedidos")[0][0]
    assert 250 <= total <= 350
    ajenos = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos p JOIN usuario_rol ur ON ur.usuario_id = p.usuario_id WHERE ur.rol_codigo <> 'CLIENT'",
    )
    assert ajenos == [(0,)]
    del_cliente_base = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos p JOIN usuario u ON u.id = p.usuario_id WHERE u.email = 'cliente@foodstore.com'",
    )[0][0]
    assert del_cliente_base >= 8
    sin_detalle = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos p WHERE NOT EXISTS (SELECT 1 FROM detalle_pedido d WHERE d.pedido_id = p.id) "
        "OR NOT EXISTS (SELECT 1 FROM historial_estado_pedido h WHERE h.pedido_id = p.id)",
    )
    assert sin_detalle == [(0,)]
    posteriores = _filas(
        migrations_db,
        f"SELECT COUNT(*) FROM pedidos WHERE created_at > '{despues.isoformat()}' OR updated_at > '{despues.isoformat()}'",
    )
    assert posteriores == [(0,)]
    hoy = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos WHERE (created_at AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date "
        "AND estado_codigo IN ('CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO')",
    )[0][0]
    assert hoy >= 1


# --- 4.3 Coherencia en la base ---------------------------------------------------------------------------------------


def test_seed_deja_totales_snapshots_e_historial_coherentes_en_cada_pedido(migrations_db: Engine) -> None:
    _sembrar(migrations_db)

    totales_incoherentes = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos p WHERE p.subtotal <> (SELECT SUM(d.subtotal_snapshot) FROM detalle_pedido d "
        "WHERE d.pedido_id = p.id) OR p.total <> p.subtotal - p.descuento + p.costo_envio "
        "OR p.costo_envio <> 50.00 OR p.descuento <> 0",
    )
    assert totales_incoherentes == [(0,)]
    lineas_incoherentes = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM detalle_pedido d JOIN productos pr ON pr.id = d.producto_id "
        "WHERE d.subtotal_snapshot <> d.precio_snapshot * d.cantidad OR d.nombre_snapshot <> pr.nombre "
        "OR d.precio_snapshot <> pr.precio_base",
    )
    assert lineas_incoherentes == [(0,)]
    personalizadas = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM detalle_pedido WHERE personalizacion IS NOT NULL "
        "AND cardinality(personalizacion) = cardinality(personalizacion_snapshot)",
    )[0][0]
    assert personalizadas >= 1

    historiales = _filas(
        migrations_db,
        "SELECT pedido_id, estado_desde, estado_hacia, created_at FROM historial_estado_pedido ORDER BY pedido_id, created_at, id",
    )
    por_pedido: dict[int, list[tuple]] = {}
    for pedido_id, desde, hacia, cuando in historiales:
        por_pedido.setdefault(pedido_id, []).append((desde, hacia, cuando))
    finales = dict(_filas(migrations_db, "SELECT id, estado_codigo FROM pedidos"))
    assert set(por_pedido) == set(finales)
    for pedido_id, filas in por_pedido.items():
        assert filas[0][:2] == (None, "PENDIENTE")
        assert filas[-1][1] == finales[pedido_id]
        for (_, hacia_previo, cuando_previo), (desde, _, cuando) in zip(filas, filas[1:]):
            assert desde == hacia_previo
            assert cuando > cuando_previo


def test_seed_cada_cancelacion_tiene_motivo(migrations_db: Engine) -> None:
    _sembrar(migrations_db)

    cancelaciones = _filas(
        migrations_db,
        "SELECT COUNT(*), COUNT(motivo) FROM historial_estado_pedido WHERE estado_hacia = 'CANCELADO'",
    )

    assert cancelaciones[0][0] > 0
    assert cancelaciones[0][0] == cancelaciones[0][1]


# --- 4.4 Pagos --------------------------------------------------------------------------------------------------------


def test_seed_registra_un_pago_aprobado_solo_para_los_pedidos_mercadopago_confirmados(
    migrations_db: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MP_ACCESS_TOKEN", "")  # el seed no debe necesitar la pasarela
    _sembrar(migrations_db)

    mp_confirmados = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pedidos p WHERE p.forma_pago_codigo = 'MERCADOPAGO' AND EXISTS "
        "(SELECT 1 FROM historial_estado_pedido h WHERE h.pedido_id = p.id AND h.estado_hacia = 'CONFIRMADO')",
    )[0][0]
    assert mp_confirmados > 0
    pagos_validos = _filas(
        migrations_db,
        "SELECT COUNT(*) FROM pagos g JOIN pedidos p ON p.id = g.pedido_id WHERE p.forma_pago_codigo = 'MERCADOPAGO' "
        "AND g.estado = 'aprobado' AND g.transaction_amount = p.total AND g.mp_order_id LIKE 'SEED-%' "
        "AND g.mp_payment_id LIKE 'SEED-%' AND EXISTS (SELECT 1 FROM historial_estado_pedido h "
        "WHERE h.pedido_id = p.id AND h.estado_hacia = 'CONFIRMADO')",
    )[0][0]
    assert pagos_validos == mp_confirmados
    assert _filas(migrations_db, "SELECT COUNT(*) FROM pagos")[0][0] == mp_confirmados
    assert _filas(migrations_db, "SELECT COUNT(*) FROM (SELECT pedido_id FROM pagos GROUP BY pedido_id HAVING COUNT(*) > 1) x") == [(0,)]


# --- 4.5 Idempotencia -------------------------------------------------------------------------------------------------

_TABLAS_DE_VENTAS = ("usuario", "direccion_entrega", "pedidos", "detalle_pedido", "historial_estado_pedido", "pagos")


def _conteos(engine: Engine) -> dict[str, int]:
    return {tabla: _filas(engine, f"SELECT COUNT(*) FROM {tabla}")[0][0] for tabla in _TABLAS_DE_VENTAS}


def test_seed_dos_corridas_no_agregan_pedidos_ni_direcciones_ni_pagos(migrations_db: Engine) -> None:
    _sembrar(migrations_db)
    primera = _conteos(migrations_db)
    assert primera["pedidos"] > 0

    seed(migrations_db)

    assert _conteos(migrations_db) == primera


# --- 4.6 Opción sin ventas --------------------------------------------------------------------------------------------


def test_seed_sin_ventas_deja_catalogo_y_clientes_pero_ningun_pedido_y_una_corrida_posterior_las_siembra(
    migrations_db: Engine,
) -> None:
    _sembrar(migrations_db, con_ventas=False)

    assert _conteos(migrations_db)["pedidos"] == 0
    assert _conteos(migrations_db)["pagos"] == 0
    assert _filas(migrations_db, "SELECT COUNT(*) FROM productos") == [(21,)]
    assert _filas(migrations_db, "SELECT COUNT(*) FROM usuario WHERE email LIKE '%@demo.foodstore.com'") == [(16,)]

    seed(migrations_db)

    assert 250 <= _conteos(migrations_db)["pedidos"] <= 350


def test_seed_con_un_pedido_de_un_cliente_de_ejemplo_no_siembra_el_historial(migrations_db: Engine) -> None:
    _sembrar(migrations_db, con_ventas=False)
    with migrations_db.begin() as conn:
        conn.execute(text(
            "INSERT INTO pedidos (usuario_id, estado_codigo, forma_pago_codigo, subtotal, descuento, costo_envio, total, "
            "created_at, updated_at) SELECT id, 'PENDIENTE', 'EFECTIVO', 100, 0, 50, 150, NOW(), NOW() "
            "FROM usuario WHERE email = 'mateo.gomez@demo.foodstore.com'"
        ))

    seed(migrations_db)

    assert _conteos(migrations_db)["pedidos"] == 1


def test_argumentos_del_seed_acepta_sin_ventas_y_por_defecto_siembra_ventas() -> None:
    from app.db.seed import parsear_argumentos

    assert parsear_argumentos([]).sin_ventas is False
    assert parsear_argumentos(["--sin-ventas"]).sin_ventas is True


# --- 4.7 Stock en vivo ------------------------------------------------------------------------------------------------


def test_seed_permite_confirmar_en_vivo_cada_pendiente_manual_sin_dejar_stock_negativo(migrations_db: Engine) -> None:
    import asyncio

    from sqlmodel import Session

    from app.modules.pedidos.schemas import PedidoCambioEstado
    from app.modules.pedidos.service import construir_pedido_service

    _sembrar(migrations_db)
    gestor_id = _filas(migrations_db, "SELECT id FROM usuario WHERE email = 'pedidos@foodstore.com'")[0][0]
    pendientes = [
        fila[0]
        for fila in _filas(
            migrations_db,
            "SELECT id FROM pedidos WHERE estado_codigo = 'PENDIENTE' AND forma_pago_codigo IN ('EFECTIVO', 'TRANSFERENCIA')",
        )
    ]
    assert pendientes, "la demo debe dejar pendientes confirmables a mano"

    for pedido_id in pendientes:
        with Session(migrations_db) as session:
            service = construir_pedido_service(session)
            asyncio.run(service.cambiar_estado_pedido(pedido_id, PedidoCambioEstado(nuevo_estado="CONFIRMADO"), gestor_id, {"PEDIDOS"}))

    assert _filas(migrations_db, "SELECT COUNT(*) FROM productos WHERE stock_cantidad < 0") == [(0,)]
    confirmados = _filas(migrations_db, f"SELECT COUNT(*) FROM pedidos WHERE id = ANY(ARRAY{pendientes}) AND estado_codigo = 'CONFIRMADO'")
    assert confirmados == [(len(pendientes),)]


# --- 5. Métricas con datos en cada período ----------------------------------------------------------------------------


def _servicio_de_metricas(engine: Engine):
    from sqlmodel import Session

    from app.modules.admin.service import EstadisticasService
    from app.modules.pedidos.unit_of_work import PedidoUnitOfWork

    session = Session(engine)
    return EstadisticasService(PedidoUnitOfWork(session)), session


def test_dashboard_tiene_ventas_e_ingresos_en_hoy_siete_dias_treinta_dias_y_este_mes(migrations_db: Engine) -> None:
    from datetime import timedelta

    _sembrar(migrations_db)
    hoy = datetime.now(timezone.utc).date()
    servicio, session = _servicio_de_metricas(migrations_db)
    with session:
        rangos = {
            "hoy": (hoy, hoy),
            "7 dias": (hoy - timedelta(days=6), hoy),
            "30 dias": (hoy - timedelta(days=29), hoy),
            "este mes": (hoy.replace(day=1), hoy),
        }
        for nombre, (desde, hasta) in rangos.items():
            resumen = servicio.resumen(desde, hasta)
            assert resumen.ventas > 0, nombre
            assert resumen.ingresos > 0, nombre


def test_dashboard_tiene_los_doce_meses_los_dias_y_los_desgloses_de_treinta_dias(migrations_db: Engine) -> None:
    from datetime import timedelta

    _sembrar(migrations_db)
    hoy = datetime.now(timezone.utc).date()
    servicio, session = _servicio_de_metricas(migrations_db)
    with session:
        meses = servicio.ventas_por_periodo(hoy - timedelta(days=365), hoy, "month")
        assert len(meses) >= 12
        assert all(m.cantidad_pedidos > 0 for m in meses[-12:])
        for agrupacion in ("day", "week"):
            periodos = servicio.ventas_por_periodo(hoy - timedelta(days=29), hoy, agrupacion)
            assert periodos and all(p.cantidad_pedidos > 0 for p in periodos)
        desde = hoy - timedelta(days=29)
        assert len(servicio.productos_top(desde, hoy, 10)) >= 5
        estados = {e.estado_codigo: e.cantidad for e in servicio.pedidos_por_estado(desde, hoy)}
        assert estados.get("ENTREGADO", 0) > 0 and estados.get("CANCELADO", 0) > 0
        formas = {f.forma_pago_codigo: f.total for f in servicio.ingresos_por_forma_pago(desde, hoy)}
        assert set(formas) == {"MERCADOPAGO", "EFECTIVO", "TRANSFERENCIA"}
        assert all(total > 0 for total in formas.values())
