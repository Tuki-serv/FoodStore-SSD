"""StockService (spec order-stock, D1/D2): descuento y devolución agrupados por producto, todo o nada."""
import pytest
from sqlmodel import Session

from app.modules.productos.models import Producto
from app.modules.productos.repository import ProductoRepository
from app.modules.productos.stock_service import LineaStock, ProductoNoDisponible, StockInsuficiente, StockService


def _producto(session: Session, nombre: str, stock: int, disponible: bool = True) -> Producto:
    producto = Producto(nombre=nombre, precio_base="100.00", disponible=disponible, stock_cantidad=stock)
    session.add(producto)
    session.commit()
    session.refresh(producto)
    return producto


def _stock(session: Session, producto_id: int) -> int:
    session.expire_all()
    return session.get(Producto, producto_id).stock_cantidad


def _servicio(session: Session) -> StockService:
    return StockService(ProductoRepository(session))


def test_descontar_resta_la_cantidad_de_la_linea_al_stock(session: Session) -> None:
    a = _producto(session, "Stock A", 5)

    _servicio(session).descontar([LineaStock(a.id, 2)])

    assert _stock(session, a.id) == 3


def test_descontar_un_producto_eliminado_lanza_stock_insuficiente(session: Session) -> None:
    a = _producto(session, "Stock A", 5)
    ProductoRepository(session).delete(a)

    with pytest.raises(StockInsuficiente):
        _servicio(session).descontar([LineaStock(a.id, 1)])


def test_descontar_suma_las_lineas_del_mismo_producto(session: Session) -> None:
    a = _producto(session, "Stock A", 5)

    _servicio(session).descontar([LineaStock(a.id, 2), LineaStock(a.id, 3)])

    assert _stock(session, a.id) == 0


def test_descontar_lineas_del_mismo_producto_que_superan_el_stock_lanza_con_el_nombre_y_no_cambia_nada(
    session: Session,
) -> None:
    a = _producto(session, "Pizza Grande", 5)

    with pytest.raises(StockInsuficiente) as exc:
        _servicio(session).descontar([LineaStock(a.id, 3), LineaStock(a.id, 3)])

    assert exc.value.producto_nombre == "Pizza Grande"
    assert _stock(session, a.id) == 5


def test_descontar_si_una_linea_alcanza_y_otra_no_ninguna_cambia(session: Session) -> None:
    a = _producto(session, "Stock A", 5)
    b = _producto(session, "Stock B", 1)

    with pytest.raises(StockInsuficiente) as exc:
        _servicio(session).descontar([LineaStock(a.id, 1), LineaStock(b.id, 2)])

    assert exc.value.producto_nombre == "Stock B"
    assert (_stock(session, a.id), _stock(session, b.id)) == (5, 1)


def test_descontar_varios_productos_resta_a_cada_uno(session: Session) -> None:
    a = _producto(session, "Stock A", 4)
    b = _producto(session, "Stock B", 3)

    _servicio(session).descontar([LineaStock(b.id, 3), LineaStock(a.id, 1)])

    assert (_stock(session, a.id), _stock(session, b.id)) == (3, 0)


def test_devolver_suma_la_cantidad_al_stock(session: Session) -> None:
    a = _producto(session, "Stock A", 3)

    _servicio(session).devolver([LineaStock(a.id, 2)])

    assert _stock(session, a.id) == 5


def test_devolver_a_un_producto_eliminado_lo_deja_sin_cambios(session: Session) -> None:
    a = _producto(session, "Stock A", 3)
    ProductoRepository(session).delete(a)

    _servicio(session).devolver([LineaStock(a.id, 2)])

    assert _stock(session, a.id) == 3


def test_alcanza_devuelve_el_producto_que_no_alcanza_o_none(session: Session) -> None:
    a = _producto(session, "Stock A", 5)
    b = _producto(session, "Stock B", 1)
    servicio = _servicio(session)

    assert servicio.alcanza([LineaStock(a.id, 5)]) is None
    faltante = servicio.alcanza([LineaStock(a.id, 1), LineaStock(b.id, 2)])
    assert faltante is not None and faltante.id == b.id
    assert servicio.alcanza([LineaStock(a.id, 3), LineaStock(a.id, 3)]).id == a.id


def test_verificar_acepta_lo_que_alcanza_sin_escribir(session: Session) -> None:
    a = _producto(session, "Stock A", 5)

    _servicio(session).verificar([LineaStock(a.id, 2), LineaStock(a.id, 3)])

    assert _stock(session, a.id) == 5


def test_verificar_rechaza_un_producto_no_disponible(session: Session) -> None:
    a = _producto(session, "Stock A", 5, disponible=False)

    with pytest.raises(ProductoNoDisponible):
        _servicio(session).verificar([LineaStock(a.id, 1)])


def test_verificar_rechaza_el_stock_insuficiente_sumando_lineas_sin_escribir(session: Session) -> None:
    a = _producto(session, "Stock A", 5)

    with pytest.raises(StockInsuficiente):
        _servicio(session).verificar([LineaStock(a.id, 3), LineaStock(a.id, 3)])

    assert _stock(session, a.id) == 5
