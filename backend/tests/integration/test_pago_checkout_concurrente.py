"""Dos `POST /pagos/crear` simultáneos del mismo pedido (C-12, D4/D6): el bloqueo del pedido los serializa.

Igual que `test_pago_webhook_concurrente.py`: no se usa la fixture `session` (una sola transacción compartida); cada hilo
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
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles
from tests.support.mp_webhook import MPFalso
from tests.support.pagos_factory import estado_pedido, historial, pagos_de, stock_de


@pytest.fixture(name="escenario")
def escenario_fixture(engine_test: Engine) -> Iterator[dict]:
    with Session(engine_test) as db:
        catalogos_vacios = db.exec(select(func.count()).select_from(Rol)).one() == 0
        seed_catalogos(db)
        db.commit()
        cliente = crear_usuario_con_roles(db, ["CLIENT"])
        prod = Producto(nombre="Concurrente-crear", precio_base="100.00", disponible=True, stock_cantidad=5)
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
        db.commit()
        datos = {
            "engine": engine_test,
            "cliente_id": cliente.id,
            "headers": bearer_de_usuario(cliente, ["CLIENT"]),
            "producto_id": prod.id,
            "pedido_id": pedido.id,
        }
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


def test_dos_crear_simultaneos_dejan_un_solo_pago_y_ambas_llamadas_a_mp_llevan_la_misma_clave(
    escenario: dict, mp_sdk: MPFalso
) -> None:
    engine: Engine = escenario["engine"]
    mp_sdk.responder_creacion(201, "approved", "accredited", payment_id=990)

    # La primera llamada a MercadoPago espera a que la segunda solicitud llegue a MercadoPago: así se prueba que la
    # segunda reutilizó el intento (misma clave) en vez de crear otro, sin depender de los tiempos de los hilos.
    segunda_llego = threading.Event()
    contador_lock = threading.Lock()
    llamadas = [0]

    def sincronizar(_creacion) -> None:
        with contador_lock:
            llamadas[0] += 1
            numero = llamadas[0]
        if numero == 1:
            assert segunda_llego.wait(timeout=20), "la segunda solicitud no llegó a MercadoPago (¿no esperó el bloqueo?)"
        else:
            segunda_llego.set()

    mp_sdk.antes_de_responder_creacion(sincronizar)

    def sesion_propia():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_session] = sesion_propia
    barrera = threading.Barrier(2)
    resultados: list[tuple[int, str]] = []
    errores: list[BaseException] = []

    def pagar(token: str) -> None:
        try:
            with TestClient(app) as cliente:
                barrera.wait(timeout=10)
                respuesta = cliente.post(
                    "/api/v1/pagos/crear",
                    json={
                        "pedido_id": escenario["pedido_id"],
                        "token": token,
                        "payment_method_id": "visa",
                        "installments": 1,
                        "payer": {"email": "a@test.com"},
                    },
                    headers=escenario["headers"],
                )
                resultados.append((respuesta.status_code, respuesta.json().get("estado", respuesta.json().get("code"))))
        except BaseException as exc:  # noqa: BLE001 - se reporta en el hilo principal
            errores.append(exc)

    try:
        hilos = [threading.Thread(target=pagar, args=(f"tok-{i}",)) for i in (1, 2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=40)
        assert all(not hilo.is_alive() for hilo in hilos), "posible deadlock: un hilo no terminó"
    finally:
        app.dependency_overrides.clear()

    assert errores == []
    assert resultados == [(201, "aprobado"), (201, "aprobado")]
    assert len(mp_sdk.creaciones) == 2
    assert mp_sdk.creaciones[0].idempotency_key == mp_sdk.creaciones[1].idempotency_key
    with Session(engine) as db:
        (pago,) = pagos_de(db, escenario["pedido_id"])
        assert pago.estado == "aprobado"
        assert estado_pedido(db, escenario["pedido_id"]) == "CONFIRMADO"
        assert stock_de(db, escenario["producto_id"]) == 3
        assert [(h.estado_hacia, h.usuario_id) for h in historial(db, escenario["pedido_id"])] == [("CONFIRMADO", None)]
