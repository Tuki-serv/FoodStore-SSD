"""Planificador puro de ventas de demostración (`app.db.ventas_demo.planificar_ventas`), sin base de datos.

Instante `ahora` fijo, catálogo y clientes en memoria y `random.Random` con semilla escrita en cada test. Los literales
(conteos, fechas, códigos de estado) son manuales: no se importan de las constantes del seed.
"""
import random
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.db.ventas_demo import ClienteDemo, PedidoPlan, ProductoVendible, planificar_ventas

AHORA = datetime(2026, 11, 23, 15, 0, 0, tzinfo=timezone.utc)
VENDIDOS = {"CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO"}


def _catalogo(stocks: dict[str, int] | None = None) -> list[ProductoVendible]:
    """Doce productos: burgers, pizza, acompañamientos, postre y bebidas; las burgers y la pizza con removibles."""
    stocks = stocks or {}
    base = [
        ("Hamburguesa Clasica", "1500.00", 5, 3, ((1, "Queso Cheddar"), (2, "Lechuga"))),
        ("Burger BBQ Bacon", "1900.00", 5, 3, ((3, "Bacon Crocante"),)),
        ("Doble Cheddar", "2300.00", 5, 3, ((1, "Queso Cheddar"),)),
        ("Pizza Muzzarella", "2400.00", 3, 3, ((4, "Oregano"),)),
        ("Papas Fritas", "900.00", 4, 4, ()),
        ("Aros de Cebolla", "1000.00", 4, 4, ()),
        ("Nuggets x6", "1300.00", 4, 4, ()),
        ("Brownie con Helado", "1400.00", 2, 3, ()),
        ("Flan con Dulce de Leche", "1100.00", 2, 3, ()),
        ("Coca-Cola 500ml", "800.00", 3, 4, ()),
        ("Agua Mineral 500ml", "600.00", 3, 4, ()),
        ("Limonada Natural", "700.00", 3, 4, ()),
    ]
    return [
        ProductoVendible(
            id=indice + 1, nombre=nombre, precio=Decimal(precio), stock=stocks.get(nombre, 50),
            peso=peso, max_cantidad=maximo, removibles=removibles,
        )
        for indice, (nombre, precio, peso, maximo, removibles) in enumerate(base)
    ]


def _clientes() -> list[ClienteDemo]:
    nombres = [f"cliente{n}@demo.test" for n in range(1, 17)]
    clientes = [ClienteDemo(id=10 + n, email=email, direccion_id=100 + n) for n, email in enumerate(nombres)]
    destacado = ClienteDemo(id=9, email="destacado@demo.test", direccion_id=99, pedidos_garantizados=10)
    return [destacado, *clientes]


def _plan(
    ahora: datetime = AHORA, semilla: int = 7, stocks: dict[str, int] | None = None
) -> list[PedidoPlan]:
    return planificar_ventas(ahora, _catalogo(stocks), _clientes(), random.Random(semilla))


def _vendido(pedido: PedidoPlan) -> bool:
    return pedido.estado_final in VENDIDOS


# --- 3.1 Cobertura temporal -------------------------------------------------------------------------------------------


def test_planificar_ventas_cubre_hoy_cada_dia_del_ultimo_mes_y_cada_mes_del_ultimo_ano() -> None:
    plan = _plan()

    vendidos = [p for p in plan if _vendido(p)]
    por_dia = Counter(p.creado_en.date() for p in vendidos)
    por_mes = Counter((p.creado_en.year, p.creado_en.month) for p in vendidos)
    hoy = AHORA.date()
    assert por_dia[hoy] >= 1
    for atras in range(30):
        assert por_dia[hoy - timedelta(days=atras)] >= 1, f"sin ventas hace {atras} dias"
    meses_anteriores = [(2025, 12)] + [(2026, mes) for mes in range(1, 11)] + []  # dic-2025 .. oct-2026
    for anio_mes in meses_anteriores:
        assert por_mes[anio_mes] >= 10, f"pocas ventas en {anio_mes}"
    assert all(p.creado_en <= AHORA for p in plan)
    assert all(p.creado_en >= AHORA - timedelta(days=365) for p in plan)
    assert 250 <= len(plan) <= 350


# --- 3.3 Bordes de fecha -----------------------------------------------------------------------------------------------


def test_planificar_ventas_justo_despues_de_medianoche_utc_deja_una_venta_hoy_y_nada_posterior_a_ahora() -> None:
    ahora = datetime(2026, 11, 23, 0, 0, 30, tzinfo=timezone.utc)

    plan = _plan(ahora=ahora)

    assert sum(1 for p in plan if _vendido(p) and p.creado_en.date() == ahora.date()) >= 1
    for pedido in plan:
        assert pedido.creado_en <= ahora
        assert all(t.cuando <= ahora for t in pedido.transiciones)


@pytest.mark.parametrize(
    ("ahora", "primer_mes"),
    [
        (datetime(2026, 12, 1, 10, 0, 0, tzinfo=timezone.utc), (2026, 1)),
        (datetime(2028, 2, 29, 12, 0, 0, tzinfo=timezone.utc), (2027, 3)),
    ],
)
def test_planificar_ventas_en_bordes_de_calendario_cubre_los_once_meses_y_los_treinta_dias(
    ahora: datetime, primer_mes: tuple[int, int]
) -> None:
    plan = _plan(ahora=ahora)

    vendidos = [p for p in plan if _vendido(p)]
    por_dia = Counter(p.creado_en.date() for p in vendidos)
    por_mes = Counter((p.creado_en.year, p.creado_en.month) for p in vendidos)
    for atras in range(30):
        assert por_dia[ahora.date() - timedelta(days=atras)] >= 1
    anio, mes = primer_mes
    for _ in range(11):
        assert por_mes[(anio, mes)] >= 10, f"pocas ventas en {(anio, mes)}"
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    assert all(p.creado_en <= ahora for p in plan)
    assert all(p.creado_en >= ahora - timedelta(days=365) for p in plan)


# --- 3.4 Mezcla de estados y activos ----------------------------------------------------------------------------------


def test_planificar_ventas_deja_entre_ocho_y_doce_activos_de_hoy_o_ayer_con_los_cuatro_estados() -> None:
    plan = _plan()

    activos = [p for p in plan if p.estado_final not in {"ENTREGADO", "CANCELADO"}]
    assert 8 <= len(activos) <= 12
    assert {p.estado_final for p in activos} == {"PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO"}
    assert all(p.creado_en.date() >= AHORA.date() - timedelta(days=1) for p in activos)


def test_planificar_ventas_mayoria_entregada_con_cancelados_y_las_tres_formas_de_pago_en_el_ultimo_mes() -> None:
    plan = _plan()

    estados = Counter(p.estado_final for p in plan)
    assert estados["ENTREGADO"] / len(plan) > 0.70
    assert estados["CANCELADO"] / len(plan) >= 0.05
    recientes = [p for p in plan if p.creado_en >= AHORA - timedelta(days=30)]
    assert {p.forma_pago for p in recientes} == {"MERCADOPAGO", "EFECTIVO", "TRANSFERENCIA"}


@pytest.mark.parametrize("semilla", [1, 99])
def test_planificar_ventas_con_otras_semillas_mantiene_la_mezcla_de_estados(semilla: int) -> None:
    plan = _plan(semilla=semilla)

    activos = [p for p in plan if p.estado_final not in {"ENTREGADO", "CANCELADO"}]
    assert 8 <= len(activos) <= 12
    assert {p.estado_final for p in activos} == {"PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO"}
    assert Counter(p.estado_final for p in plan)["CANCELADO"] / len(plan) >= 0.05


def test_planificar_ventas_asigna_al_cliente_destacado_sus_pedidos_con_uno_activo() -> None:
    plan = _plan()

    propios = [p for p in plan if p.cliente.email == "destacado@demo.test"]
    assert len(propios) >= 10
    assert any(p.estado_final not in {"ENTREGADO", "CANCELADO"} for p in propios)


# --- 3.5 Historial válido según la máquina de estados -----------------------------------------------------------------

_ROLES_POR_ACTOR = {"CLIENT": {"CLIENT"}, "PEDIDOS": {"PEDIDOS"}, "ADMIN": {"ADMIN"}}


def test_planificar_ventas_cada_historial_es_valido_para_la_maquina_de_estados() -> None:
    from app.modules.pedidos.fsm import ACTOR_SISTEMA, Actor, destinos_permitidos

    for pedido in _plan():
        primera, *resto = pedido.transiciones
        assert (primera.desde, primera.hacia, primera.actor) == (None, "PENDIENTE", "CLIENT")
        assert primera.cuando == pedido.creado_en
        anterior = primera
        for transicion in resto:
            actor = ACTOR_SISTEMA if transicion.actor == "SISTEMA" else Actor.usuario(1, _ROLES_POR_ACTOR[transicion.actor])
            assert transicion.desde == anterior.hacia
            assert transicion.hacia in destinos_permitidos(actor, transicion.desde, pedido.forma_pago)
            assert transicion.cuando > anterior.cuando
            anterior = transicion
        assert anterior.hacia == pedido.estado_final
        assert anterior.cuando <= AHORA


def test_planificar_ventas_confirma_mercadopago_por_el_sistema_y_el_resto_por_un_gestor() -> None:
    confirmaciones = [
        (pedido.forma_pago, t.actor) for pedido in _plan() for t in pedido.transiciones if t.hacia == "CONFIRMADO"
    ]

    assert confirmaciones
    for forma_pago, actor in confirmaciones:
        if forma_pago == "MERCADOPAGO":
            assert actor == "SISTEMA"
        else:
            assert actor in {"PEDIDOS", "ADMIN"}


def test_planificar_ventas_cada_cancelacion_lleva_motivo_y_la_de_mercadopago_sale_de_pendiente() -> None:
    cancelados = [p for p in _plan() if p.estado_final == "CANCELADO"]

    assert cancelados
    for pedido in cancelados:
        ultima = pedido.transiciones[-1]
        assert ultima.hacia == "CANCELADO"
        assert ultima.motivo
        if pedido.forma_pago == "MERCADOPAGO":
            assert ultima.desde == "PENDIENTE"
            assert ultima.actor == "CLIENT"


# --- 3.6 Importes y líneas ---------------------------------------------------------------------------------------------


def test_planificar_ventas_importes_coherentes_sin_productos_repetidos() -> None:
    for pedido in _plan():
        ids = [linea.producto.id for linea in pedido.lineas]
        assert 1 <= len(ids) <= 4
        assert len(set(ids)) == len(ids)
        assert all(linea.cantidad >= 1 for linea in pedido.lineas)
        subtotal = sum((linea.producto.precio * linea.cantidad for linea in pedido.lineas), Decimal("0.00"))
        assert pedido.subtotal == subtotal
        assert pedido.costo_envio == Decimal("50.00")
        assert pedido.descuento == Decimal("0.00")
        assert pedido.total == subtotal + Decimal("50.00")


def test_planificar_ventas_personaliza_solo_con_ingredientes_removibles_y_al_menos_una_linea() -> None:
    lineas = [linea for pedido in _plan() for linea in pedido.lineas]

    personalizadas = [linea for linea in lineas if linea.personalizacion]
    assert personalizadas
    for linea in personalizadas:
        permitidos = dict(linea.producto.removibles)
        assert len(linea.personalizacion) == len(linea.personalizacion_nombres) == 1
        for ingrediente_id, nombre in zip(linea.personalizacion, linea.personalizacion_nombres):
            assert permitidos[ingrediente_id] == nombre
    assert all(not linea.personalizacion for linea in lineas if not linea.producto.removibles)


# --- 3.7 Stock ---------------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "stocks",
    [
        {"Flan con Dulce de Leche": 0, "Brownie con Helado": 4},
        {"Hamburguesa Clasica": 1, "Papas Fritas": 1, "Coca-Cola 500ml": 1, "Flan con Dulce de Leche": 0},
    ],
)
def test_planificar_ventas_los_pendientes_nunca_superan_el_stock_ni_usan_productos_agotados(stocks: dict[str, int]) -> None:
    catalogo = {p.id: p for p in _catalogo(stocks)}

    plan = planificar_ventas(AHORA, list(catalogo.values()), _clientes(), random.Random(3))

    pedido_por_producto: Counter[int] = Counter()
    for pedido in plan:
        if pedido.estado_final == "PENDIENTE":
            for linea in pedido.lineas:
                pedido_por_producto[linea.producto.id] += linea.cantidad
    assert pedido_por_producto
    for producto_id, cantidad in pedido_por_producto.items():
        assert catalogo[producto_id].stock > 0
        assert cantidad <= catalogo[producto_id].stock


# --- 3.8 Determinismo --------------------------------------------------------------------------------------------------


def test_planificar_ventas_con_la_misma_semilla_devuelve_planes_iguales_y_con_otra_distintos() -> None:
    assert _plan(semilla=5) == _plan(semilla=5)
    assert _plan(semilla=5) != _plan(semilla=6)


# --- Pendientes confirmables a mano (la demo muestra el flujo del gestor) ---------------------------------------------


@pytest.mark.parametrize("dias_despues", range(0, 40, 3))
def test_planificar_ventas_deja_al_menos_un_pendiente_efectivo_o_transferencia_en_cualquier_dia(dias_despues: int) -> None:
    plan = _plan(ahora=AHORA + timedelta(days=dias_despues))

    manuales = [p for p in plan if p.estado_final == "PENDIENTE" and p.forma_pago in {"EFECTIVO", "TRANSFERENCIA"}]
    assert manuales
