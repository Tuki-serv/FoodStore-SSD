"""Estadísticas de ventas (spec `sales-metrics`, C-24): definición de venta, rango, resumen y reportes."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.pagos.models import Pago
from app.modules.pedidos.models import DetallePedido, Pedido
from app.modules.productos.models import Producto

BASE = "/api/v1/estadisticas"
DIA = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(name="crear_pedido")
def crear_pedido_fixture(session: Session, normal_user: dict, direccion_db):
    """Fábrica: `crear_pedido(estado, forma_pago, total, created_at, lineas=())`; `lineas` = [(producto, cantidad, subtotal)]."""

    def _crear(estado: str, forma_pago: str, total: str, created_at: datetime = DIA, lineas=()) -> Pedido:
        pedido = Pedido(
            usuario_id=normal_user["id"], estado_codigo=estado, forma_pago_codigo=forma_pago,
            direccion_id=direccion_db.id, subtotal=total, total=total, costo_envio="0", descuento="0",
            created_at=created_at,
        )
        session.add(pedido)
        session.flush()
        for producto, cantidad, subtotal in lineas:
            session.add(DetallePedido(
                pedido_id=pedido.id, producto_id=producto.id, cantidad=cantidad, nombre_snapshot=producto.nombre,
                precio_snapshot=Decimal(subtotal) / cantidad, subtotal_snapshot=subtotal,
            ))
        session.commit()
        session.refresh(pedido)
        return pedido

    return _crear


@pytest.fixture(name="crear_producto")
def crear_producto_fixture(session: Session):
    def _crear(nombre: str) -> Producto:
        producto = Producto(nombre=nombre, precio_base="100.00", disponible=True, stock_cantidad=100)
        session.add(producto)
        session.commit()
        session.refresh(producto)
        return producto

    return _crear


def _get(client: TestClient, headers: dict, reporte: str, **params) -> object:
    return client.get(f"{BASE}/{reporte}", params=params, headers=headers)


def _rango(desde: str = "2026-11-10", hasta: str = "2026-11-10") -> dict:
    return {"desde": desde, "hasta": hasta}


# ===========================================================================
# Resumen y definición de venta
# ===========================================================================
class TestResumen:
    def test_efectivo_confirmado_sin_pago_es_venta(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "1500.00")

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert data["ventas"] == 1
        assert data["ingresos"] == "1500.00"

    def test_pendiente_y_cancelado_no_cuentan(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("PENDIENTE", "EFECTIVO", "1000.00")
        crear_pedido("CANCELADO", "EFECTIVO", "2000.00")

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert (data["ventas"], data["ingresos"], data["ticket_promedio"]) == (0, "0.00", "0.00")

    def test_ticket_promedio(self, client, admin_auth_headers, crear_pedido):
        for total, estado in (("1000.00", "CONFIRMADO"), ("1500.00", "EN_PREP"), ("2000.00", "ENTREGADO")):
            crear_pedido(estado, "EFECTIVO", total)

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert (data["ventas"], data["ingresos"], data["ticket_promedio"]) == (3, "4500.00", "1500.00")

    def test_ticket_con_decimales_periodicos_se_redondea(self, client, admin_auth_headers, crear_pedido):
        for total in ("100.00", "0.00", "0.00"):
            crear_pedido("CONFIRMADO", "EFECTIVO", total)

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert (data["ventas"], data["ingresos"], data["ticket_promedio"]) == (3, "100.00", "33.33")

    def test_ticket_redondea_medio_hacia_arriba(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "0.01")
        crear_pedido("CONFIRMADO", "EFECTIVO", "0.00")

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert data["ticket_promedio"] == "0.01"  # 0.005 -> 0.01

    def test_mercadopago_con_intento_rechazado_cuenta_una_vez(
        self, client, session, admin_auth_headers, crear_pedido
    ):
        pedido = crear_pedido("CONFIRMADO", "MERCADOPAGO", "800.00")
        for i, estado in enumerate(("rejected", "approved")):
            session.add(Pago(pedido_id=pedido.id, transaction_amount="800", mp_status=estado, idempotency_key=f"k-{i}"))
        session.commit()

        data = _get(client, admin_auth_headers, "resumen", **_rango()).json()

        assert (data["ventas"], data["ingresos"]) == (1, "800.00")

    def test_pedidos_activos_ignora_el_rango(self, client, admin_auth_headers, crear_pedido):
        hoy = datetime.now(timezone.utc)
        crear_pedido("EN_PREP", "EFECTIVO", "100.00", hoy - timedelta(days=1))
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00", hoy)
        crear_pedido("ENTREGADO", "EFECTIVO", "100.00", hoy)
        dia = hoy.date().isoformat()

        data = _get(client, admin_auth_headers, "resumen", desde=dia, hasta=dia).json()

        assert data["pedidos_activos"] == 1
        assert data["ventas"] == 1  # el EN_PREP de ayer queda fuera del rango; solo cuenta el ENTREGADO de hoy


# ===========================================================================
# Rango de fechas
# ===========================================================================
REPORTES = ["resumen", "ventas", "productos-top", "pedidos-por-estado", "ingresos"]


@pytest.mark.parametrize("reporte", REPORTES)
class TestRango:
    def test_rango_invertido(self, client, admin_auth_headers, reporte):
        r = _get(client, admin_auth_headers, reporte, desde="2026-11-20", hasta="2026-11-01")
        assert r.status_code == 422
        assert (r.json()["code"], r.json()["field"]) == ("VALIDATION_ERROR", "desde")

    def test_rango_mayor_a_366_dias(self, client, admin_auth_headers, reporte):
        r = _get(client, admin_auth_headers, reporte, desde="2026-01-01", hasta="2027-01-03")  # 368 días
        assert r.status_code == 422
        assert (r.json()["code"], r.json()["field"]) == ("VALIDATION_ERROR", "hasta")

    def test_rango_de_367_dias_es_invalido_y_de_366_valido(self, client, admin_auth_headers, reporte):
        # días contados de forma inclusiva: 2026-01-01..2027-01-02 son 367, ..2027-01-01 son 366
        assert _get(client, admin_auth_headers, reporte, desde="2026-01-01", hasta="2027-01-02").status_code == 422
        assert _get(client, admin_auth_headers, reporte, desde="2026-01-01", hasta="2027-01-01").status_code == 200

    def test_falta_hasta(self, client, admin_auth_headers, reporte):
        r = _get(client, admin_auth_headers, reporte, desde="2026-11-01")
        assert r.status_code == 422
        assert (r.json()["code"], r.json()["field"]) == ("VALIDATION_ERROR", "hasta")

    def test_sin_sesion_y_sin_parametros_es_401(self, client, reporte):
        r = client.get(f"{BASE}/{reporte}")
        assert r.status_code == 401
        assert r.json()["code"] == "HTTP_401"

    def test_gestor_de_pedidos_es_403(self, client, usuario_con_roles, reporte):
        _, headers = usuario_con_roles(["CLIENT", "PEDIDOS"])
        r = _get(client, headers, reporte, **_rango())
        assert r.status_code == 403
        assert r.json()["code"] == "HTTP_403"


# ===========================================================================
# Ventas por período
# ===========================================================================
class TestVentasPorPeriodo:
    def test_dias_sin_ventas_se_rellenan(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "1000.00")

        data = _get(client, admin_auth_headers, "ventas", **_rango("2026-11-09", "2026-11-11")).json()

        assert data == [
            {"fecha": "2026-11-09", "total_ventas": "0.00", "cantidad_pedidos": 0},
            {"fecha": "2026-11-10", "total_ventas": "1000.00", "cantidad_pedidos": 1},
            {"fecha": "2026-11-11", "total_ventas": "0.00", "cantidad_pedidos": 0},
        ]

    def test_borde_utc_cuenta_en_su_fecha(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "1000.00", datetime(2026, 11, 10, 1, 30, tzinfo=timezone.utc))

        data = _get(client, admin_auth_headers, "ventas", **_rango("2026-11-09", "2026-11-11")).json()

        assert [(i["fecha"], i["cantidad_pedidos"]) for i in data] == [
            ("2026-11-09", 0), ("2026-11-10", 1), ("2026-11-11", 0)]

    def test_agrupacion_mensual(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "100.00", datetime(2026, 10, 31, 12, tzinfo=timezone.utc))
        crear_pedido("ENTREGADO", "EFECTIVO", "200.00", datetime(2026, 11, 2, 12, tzinfo=timezone.utc))

        data = _get(client, admin_auth_headers, "ventas", **_rango("2026-10-15", "2026-11-15"), agrupacion="month").json()

        assert [(i["fecha"], i["cantidad_pedidos"]) for i in data] == [("2026-10-01", 1), ("2026-11-01", 1)]

    def test_agrupacion_semanal_arranca_en_lunes(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "100.00", datetime(2026, 11, 11, 12, tzinfo=timezone.utc))  # miércoles

        data = _get(client, admin_auth_headers, "ventas", **_rango("2026-11-04", "2026-11-17"), agrupacion="week").json()

        assert [(i["fecha"], i["cantidad_pedidos"]) for i in data] == [
            ("2026-11-02", 0), ("2026-11-09", 1), ("2026-11-16", 0)]  # 2026-11-09 es lunes

    def test_agrupacion_invalida(self, client, admin_auth_headers):
        r = _get(client, admin_auth_headers, "ventas", **_rango("2026-11-01", "2026-11-20"), agrupacion="year")
        assert r.status_code == 422
        assert (r.json()["code"], r.json()["field"]) == ("VALIDATION_ERROR", "agrupacion")

    def test_rango_de_un_solo_dia(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "100.00")

        data = _get(client, admin_auth_headers, "ventas", **_rango()).json()

        assert [(i["fecha"], i["total_ventas"]) for i in data] == [("2026-11-10", "100.00")]

    def test_mes_que_cruza_de_anio(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "100.00", datetime(2027, 1, 5, 12, tzinfo=timezone.utc))

        data = _get(client, admin_auth_headers, "ventas", **_rango("2026-12-20", "2027-01-10"), agrupacion="month").json()

        assert [(i["fecha"], i["cantidad_pedidos"]) for i in data] == [("2026-12-01", 0), ("2027-01-01", 1)]

    def test_pedidos_no_vendidos_no_suman(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00")
        crear_pedido("CANCELADO", "EFECTIVO", "100.00")

        data = _get(client, admin_auth_headers, "ventas", **_rango()).json()

        assert data == [{"fecha": "2026-11-10", "total_ventas": "0.00", "cantidad_pedidos": 0}]


# ===========================================================================
# Productos más vendidos
# ===========================================================================
class TestProductosTop:
    def test_orden_por_cantidad(self, client, admin_auth_headers, crear_pedido, crear_producto):
        pizza, empanada = crear_producto("Pizza"), crear_producto("Empanada")
        crear_pedido("CONFIRMADO", "EFECTIVO", "5000.00", lineas=[(pizza, 5, "5000.00")])
        crear_pedido("CONFIRMADO", "EFECTIVO", "2400.00", lineas=[(empanada, 8, "2400.00")])

        data = _get(client, admin_auth_headers, "productos-top", **_rango()).json()

        assert [(i["producto_id"], i["nombre"], i["cantidad_vendida"], i["ingresos"]) for i in data] == [
            (empanada.id, "Empanada", 8, "2400.00"), (pizza.id, "Pizza", 5, "5000.00")]

    def test_desempate_por_ingresos(self, client, admin_auth_headers, crear_pedido, crear_producto):
        barato, caro = crear_producto("Barato"), crear_producto("Caro")
        crear_pedido("CONFIRMADO", "EFECTIVO", "300.00", lineas=[(barato, 3, "300.00"), (caro, 3, "900.00")])

        data = _get(client, admin_auth_headers, "productos-top", **_rango()).json()

        assert [i["nombre"] for i in data] == ["Caro", "Barato"]

    def test_homonimos_son_dos_elementos(self, client, session, admin_auth_headers, crear_pedido, crear_producto):
        # El nombre es único entre productos activos: el homónimo existe porque el primero fue dado de baja
        t1 = crear_producto("Tarta")
        t1.deleted_at = datetime.now(timezone.utc)
        session.commit()
        t2 = crear_producto("Tarta")
        crear_pedido("CONFIRMADO", "EFECTIVO", "200.00", lineas=[(t1, 1, "100.00"), (t2, 1, "100.00")])

        data = _get(client, admin_auth_headers, "productos-top", **_rango()).json()

        assert len(data) == 2
        assert {i["producto_id"] for i in data} == {t1.id, t2.id}

    def test_pedido_cancelado_excluido(self, client, admin_auth_headers, crear_pedido, crear_producto):
        pizza = crear_producto("Pizza")
        crear_pedido("CANCELADO", "EFECTIVO", "100.00", lineas=[(pizza, 1, "100.00")])
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00", lineas=[(pizza, 1, "100.00")])

        assert _get(client, admin_auth_headers, "productos-top", **_rango()).json() == []

    def test_agrupa_lineas_del_mismo_producto(self, client, admin_auth_headers, crear_pedido, crear_producto):
        pizza = crear_producto("Pizza")
        crear_pedido("CONFIRMADO", "EFECTIVO", "100.00", lineas=[(pizza, 1, "100.00")])
        crear_pedido("ENTREGADO", "EFECTIVO", "200.00", lineas=[(pizza, 2, "200.00")])

        data = _get(client, admin_auth_headers, "productos-top", **_rango()).json()

        assert [(i["cantidad_vendida"], i["ingresos"]) for i in data] == [(3, "300.00")]

    def test_limit_por_defecto_5_y_limit_explicito(self, client, admin_auth_headers, crear_pedido, crear_producto):
        productos = [crear_producto(f"P{i}") for i in range(7)]
        crear_pedido("CONFIRMADO", "EFECTIVO", "700.00", lineas=[(p, 1, "100.00") for p in productos])

        assert len(_get(client, admin_auth_headers, "productos-top", **_rango()).json()) == 5
        assert len(_get(client, admin_auth_headers, "productos-top", **_rango(), limit=7).json()) == 7

    @pytest.mark.parametrize("limit", [21, 0])
    def test_limit_fuera_de_rango(self, client, admin_auth_headers, limit):
        r = _get(client, admin_auth_headers, "productos-top", **_rango(), limit=limit)
        assert r.status_code == 422
        assert (r.json()["code"], r.json()["field"]) == ("VALIDATION_ERROR", "limit")


# ===========================================================================
# Pedidos por estado e ingresos por forma de pago
# ===========================================================================
ESTADOS_FSM = ["PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO", "ENTREGADO", "CANCELADO"]


class TestPedidosPorEstado:
    def test_incluye_cancelados_y_ceros_en_orden_fsm(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00")
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00")
        crear_pedido("CANCELADO", "EFECTIVO", "100.00")

        data = _get(client, admin_auth_headers, "pedidos-por-estado", **_rango()).json()

        assert [(i["estado_codigo"], i["cantidad"]) for i in data] == [
            ("PENDIENTE", 2), ("CONFIRMADO", 0), ("EN_PREP", 0), ("EN_CAMINO", 0), ("ENTREGADO", 0), ("CANCELADO", 1)]

    def test_rango_sin_pedidos_son_seis_ceros(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("PENDIENTE", "EFECTIVO", "100.00", datetime(2026, 11, 20, 12, tzinfo=timezone.utc))

        data = _get(client, admin_auth_headers, "pedidos-por-estado", **_rango()).json()

        assert [(i["estado_codigo"], i["cantidad"]) for i in data] == [(e, 0) for e in ESTADOS_FSM]


class TestIngresosPorFormaPago:
    def test_efectivo_y_mercadopago_ordenados_por_total(self, client, admin_auth_headers, crear_pedido):
        crear_pedido("CONFIRMADO", "EFECTIVO", "1500.00")
        crear_pedido("CONFIRMADO", "MERCADOPAGO", "500.00")
        crear_pedido("ENTREGADO", "MERCADOPAGO", "500.00")
        crear_pedido("PENDIENTE", "TRANSFERENCIA", "900.00")

        data = _get(client, admin_auth_headers, "ingresos", **_rango()).json()

        assert [(i["forma_pago_codigo"], i["total"], i["cantidad"]) for i in data] == [
            ("EFECTIVO", "1500.00", 1), ("MERCADOPAGO", "1000.00", 2), ("TRANSFERENCIA", "0.00", 0)]

    def test_rango_sin_ventas_todas_las_formas_en_cero_por_codigo(self, client, admin_auth_headers):
        data = _get(client, admin_auth_headers, "ingresos", **_rango()).json()

        assert [(i["forma_pago_codigo"], i["total"], i["cantidad"]) for i in data] == [
            ("EFECTIVO", "0.00", 0), ("MERCADOPAGO", "0.00", 0), ("TRANSFERENCIA", "0.00", 0)]
