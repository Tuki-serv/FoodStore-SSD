"""Notificaciones concurrentes del mismo pago aprobado (C-05, D5): el `SELECT ... FOR UPDATE` sobre `pagos` las serializa.

Igual que `test_pedidos_stock_concurrente.py`: no se usa la fixture `session` (una sola transacción compartida); cada hilo
abre su propia sesión con commits reales. Como los datos quedan confirmados, el test los crea y los borra.
"""
import threading
from collections.abc import Iterator

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
from app.modules.pagos.models import Pago
from app.modules.pedidos.models import Pedido
from app.modules.productos.models import Producto
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from tests.support.auth_helpers import crear_usuario_con_roles
from tests.support.mp_webhook import MPFalso, post_webhook
from tests.support.pagos_factory import estado_pedido, historial, pagos_de, stock_de


@pytest.fixture(name="escenario")
def escenario_fixture(engine_test: Engine) -> Iterator[dict]:
    with Session(engine_test) as db:
        catalogos_vacios = db.exec(select(func.count()).select_from(Rol)).one() == 0
        seed_catalogos(db)
        db.commit()
        cliente = crear_usuario_con_roles(db, ["CLIENT"])
        prod = Producto(nombre="Concurrente-pago", precio_base="100.00", disponible=True, stock_cantidad=5)
        db.add(prod)
        db.commit()
        pedido = Pedido(
            usuario_id=cliente.id,
            estado_codigo="PENDIENTE",
            forma_pago_codigo="MERCADOPAGO",
            subtotal="200.00",
            total="200.00",
            costo_envio="0.00",
            descuento="0.00",
        )
        db.add(pedido)
        db.flush()
        db.add(
            DetallePedido(
                pedido_id=pedido.id,
                producto_id=prod.id,
                cantidad=2,
                nombre_snapshot="x",
                precio_snapshot="100.00",
                subtotal_snapshot="200.00",
            )
        )
        db.add(Pago(pedido_id=pedido.id, transaction_amount="200.00", idempotency_key="idem-concurrente-1"))
        db.commit()
        datos = {"engine": engine_test, "cliente_id": cliente.id, "producto_id": prod.id, "pedido_id": pedido.id}
    yield datos
    with Session(engine_test) as db:
        db.exec(delete(HistorialEstadoPedido).where(HistorialEstadoPedido.pedido_id == datos["pedido_id"]))
        db.exec(delete(DetallePedido).where(DetallePedido.pedido_id == datos["pedido_id"]))
        db.exec(delete(Pago).where(Pago.pedido_id == datos["pedido_id"]))
        db.exec(delete(Pedido).where(Pedido.id == datos["pedido_id"]))
        db.exec(delete(Producto).where(Producto.id == datos["producto_id"]))
        db.exec(delete(UsuarioRol).where(UsuarioRol.usuario_id == datos["cliente_id"]))
        db.exec(delete(Usuario).where(Usuario.id == datos["cliente_id"]))
        if catalogos_vacios:  # no dejar catálogos confirmados que otros tests no esperan
            db.exec(delete(FormaPago))
            db.exec(delete(EstadoPedido))
            db.exec(delete(Rol))
        db.commit()


def test_dos_notificaciones_simultaneas_del_mismo_pago_aprobado_confirman_una_sola_vez(
    escenario: dict, mp_sdk: MPFalso
) -> None:
    engine: Engine = escenario["engine"]
    mp_sdk.responder(123, str(escenario["pedido_id"]))

    def sesion_propia():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = sesion_propia
    barrera = threading.Barrier(2)
    resultados: list[tuple[int, str]] = []
    errores: list[BaseException] = []

    def entregar() -> None:
        try:
            with TestClient(app) as cliente:
                barrera.wait(timeout=10)
                respuesta = post_webhook(cliente, "123")
                resultados.append((respuesta.status_code, respuesta.json()["status"]))
        except BaseException as exc:  # noqa: BLE001 - se reporta en el hilo principal
            errores.append(exc)

    try:
        hilos = [threading.Thread(target=entregar) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=30)
        assert all(not hilo.is_alive() for hilo in hilos), "posible deadlock: un hilo no terminó"
    finally:
        app.dependency_overrides.clear()

    assert errores == []
    assert sorted(resultados) == [(200, "already_processed"), (200, "processed")]
    with Session(engine) as db:
        assert estado_pedido(db, escenario["pedido_id"]) == "CONFIRMADO"
        assert stock_de(db, escenario["producto_id"]) == 3
        assert [(h.estado_hacia, h.usuario_id) for h in historial(db, escenario["pedido_id"])] == [("CONFIRMADO", None)]
        assert [p.estado for p in pagos_de(db, escenario["pedido_id"])] == ["aprobado"]
