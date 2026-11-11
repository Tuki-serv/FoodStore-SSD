"""Confirmaciones concurrentes (spec order-stock, D1/D2): el bloqueo `FOR UPDATE` serializa el descuento.

Igual que `test_auth_refresh_concurrente.py`: no se usa la fixture `session` (una sola transacción compartida); cada
hilo abre su propia sesión de BD con commits reales. Como los datos quedan confirmados, el test los crea y los borra.
"""
import threading
from collections.abc import Iterator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.database import get_session
from app.db.seed import seed_catalogos
from app.main import app
from app.modules.detalles_pedido.models import DetallePedido
from app.modules.estados_pedido.models import EstadoPedido
from app.modules.formas_pago.models import FormaPago
from app.modules.historiales_estado_pedido.models import HistorialEstadoPedido
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles


@dataclass
class Escenario:
    engine: Engine
    headers: dict[str, str]
    cliente_id: int
    productos: list[int]
    pedidos: list[int]

    def producto(self, nombre: str, stock: int) -> int:
        with Session(self.engine) as db:
            producto = Producto(nombre=f"{nombre}-concurrente", precio_base="100.00", disponible=True, stock_cantidad=stock)
            db.add(producto)
            db.commit()
            self.productos.append(producto.id)
            return producto.id

    def pedido(self, lineas: list[tuple[int, int]]) -> int:
        with Session(self.engine) as db:
            pedido = Pedido(
                usuario_id=self.cliente_id,
                estado_codigo="PENDIENTE",
                forma_pago_codigo="EFECTIVO",
                subtotal="100.00",
                total="100.00",
                costo_envio="0.00",
                descuento="0.00",
            )
            db.add(pedido)
            db.flush()
            for producto_id, cantidad in lineas:
                db.add(
                    DetallePedido(
                        pedido_id=pedido.id,
                        producto_id=producto_id,
                        cantidad=cantidad,
                        nombre_snapshot="x",
                        precio_snapshot="100.00",
                        subtotal_snapshot=str(100 * cantidad),
                    )
                )
            db.commit()
            self.pedidos.append(pedido.id)
            return pedido.id

    def stock(self, producto_id: int) -> int:
        with Session(self.engine) as db:
            return db.get(Producto, producto_id).stock_cantidad


@pytest.fixture(name="escenario")
def escenario_fixture(engine_test: Engine) -> Iterator[Escenario]:
    with Session(engine_test) as db:
        catalogos_vacios = db.exec(select(func.count()).select_from(Rol)).one() == 0
        seed_catalogos(db)
        db.commit()
        pedidos_user = crear_usuario_con_roles(db, ["PEDIDOS"])
        cliente = crear_usuario_con_roles(db, ["CLIENT"])
        headers = bearer_de_usuario(pedidos_user, ["PEDIDOS"])
        usuarios = [pedidos_user.id, cliente.id]
        datos = Escenario(engine_test, headers, cliente.id, [], [])
    yield datos
    with Session(engine_test) as db:
        db.exec(delete(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id.in_(datos.pedidos)))
        db.exec(delete(DetallePedido).where(DetallePedido.pedido_id.in_(datos.pedidos)))
        db.exec(delete(Pedido).where(Pedido.id.in_(datos.pedidos)))
        db.exec(delete(Producto).where(Producto.id.in_(datos.productos)))
        db.exec(delete(UsuarioRol).where(UsuarioRol.usuario_id.in_(usuarios)))
        db.exec(delete(Usuario).where(Usuario.id.in_(usuarios)))
        if catalogos_vacios:  # no dejar catálogos confirmados que otros tests no esperan
            db.exec(delete(FormaPago))
            db.exec(delete(EstadoPedido))
            db.exec(delete(Rol))
        db.commit()


def _confirmar_en_paralelo(engine: Engine, headers: dict[str, str], pedido_ids: list[int]) -> list[int]:
    """Confirma cada pedido desde un hilo propio (sesión propia, arranque sincronizado); devuelve los status."""

    def sesion_propia():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = sesion_propia
    barrera = threading.Barrier(len(pedido_ids))
    status: list[int] = []
    errores: list[BaseException] = []

    def confirmar(pedido_id: int) -> None:
        try:
            with TestClient(app) as cliente:
                barrera.wait(timeout=10)
                respuesta = cliente.patch(
                    f"/api/v1/pedidos/{pedido_id}/estado", json={"estado_hacia": "CONFIRMADO"}, headers=headers
                )
                status.append(respuesta.status_code)
        except BaseException as exc:  # noqa: BLE001 - se reporta en el hilo principal
            errores.append(exc)

    try:
        hilos = [threading.Thread(target=confirmar, args=(pid,)) for pid in pedido_ids]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=30)
        assert all(not hilo.is_alive() for hilo in hilos), "posible deadlock: un hilo no terminó"
    finally:
        app.dependency_overrides.clear()
    assert errores == []
    return sorted(status)


def test_dos_confirmaciones_simultaneas_sobre_la_ultima_unidad_dejan_un_200_y_un_409_con_stock_cero(
    escenario: Escenario,
) -> None:
    producto = escenario.producto("Ultima", 1)
    pedidos = [escenario.pedido([(producto, 1)]), escenario.pedido([(producto, 1)])]

    status = _confirmar_en_paralelo(escenario.engine, escenario.headers, pedidos)

    assert status == [200, 409]
    assert escenario.stock(producto) == 0
    with Session(escenario.engine) as db:
        estados = sorted(db.get(Pedido, pid).estado_codigo for pid in pedidos)
    assert estados == ["CONFIRMADO", "PENDIENTE"]


def test_pedidos_con_los_mismos_productos_en_distinto_orden_se_confirman_sin_deadlock(
    escenario: Escenario,
) -> None:
    a = escenario.producto("A", 10)
    b = escenario.producto("B", 10)
    pedidos = [escenario.pedido([(a, 2), (b, 3)]), escenario.pedido([(b, 4), (a, 1)])]

    status = _confirmar_en_paralelo(escenario.engine, escenario.headers, pedidos)

    assert status == [200, 200]
    assert (escenario.stock(a), escenario.stock(b)) == (7, 3)
