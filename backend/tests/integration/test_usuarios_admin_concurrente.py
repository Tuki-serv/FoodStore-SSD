"""Último ADMIN bajo concurrencia (C-23, spec `user-administration`, D2): el bloqueo sobre el rol `ADMIN` serializa las bajas.

Igual que `test_pedidos_stock_concurrente.py`: no se usa la fixture `session` (una sola transacción compartida); cada
hilo abre su propia sesión de BD con commits reales. Como los datos quedan confirmados, el test los crea y los borra.
"""
import threading
from collections.abc import Callable, Iterator
from dataclasses import dataclass

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, text
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.database import get_session
from app.db.seed import seed_catalogos
from app.main import app
from app.modules.pagos.models import FormaPago
from app.modules.pedidos.models import EstadoPedido
from app.modules.usuarios.models import Rol, Usuario, UsuarioRol
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles

BASE = "/api/v1/admin/usuarios/"


@dataclass
class Escenario:
    engine: Engine
    admin_a: Usuario
    admin_b: Usuario
    cliente_id: int
    headers_a: dict[str, str]
    headers_b: dict[str, str]

    def admins_activos(self) -> list[int]:
        with Session(self.engine) as db:
            filas = db.exec(
                select(UsuarioRol.usuario_id)
                .join(Usuario, Usuario.id == UsuarioRol.usuario_id)
                .where(UsuarioRol.rol_codigo == "ADMIN", Usuario.deleted_at.is_(None))
                .order_by(UsuarioRol.usuario_id)
            ).all()
        return list(filas)


@pytest.fixture(name="escenario")
def escenario_fixture(engine_test: Engine) -> Iterator[Escenario]:
    with Session(engine_test) as db:
        catalogos_vacios = db.exec(select(func.count()).select_from(Rol)).one() == 0
        seed_catalogos(db)
        db.commit()
        admin_a = crear_usuario_con_roles(db, ["ADMIN"])
        admin_b = crear_usuario_con_roles(db, ["ADMIN"])
        cliente = crear_usuario_con_roles(db, ["CLIENT"])
        datos = Escenario(
            engine_test, admin_a, admin_b, cliente.id, bearer_de_usuario(admin_a, ["ADMIN"]), bearer_de_usuario(admin_b, ["ADMIN"])
        )
        usuarios = [admin_a.id, admin_b.id, cliente.id]
    assert datos.admins_activos() == sorted([admin_a.id, admin_b.id]), "la base de tests tiene otros ADMIN confirmados"
    yield datos
    with Session(engine_test) as db:
        db.exec(delete(UsuarioRol).where(UsuarioRol.usuario_id.in_(usuarios)))
        db.exec(delete(Usuario).where(Usuario.id.in_(usuarios)))
        if catalogos_vacios:  # no dejar catálogos confirmados que otros tests no esperan
            db.exec(delete(FormaPago))
            db.exec(delete(EstadoPedido))
            db.exec(delete(Rol))
        db.commit()


def _sesion_propia(engine: Engine):
    def override():
        with Session(engine) as db:
            yield db

    return override


def _retener_bloqueo_del_rol_admin(engine: Engine):
    """Conexión aparte que retiene `SELECT ... FOR UPDATE` sobre la fila del rol ADMIN hasta `cerrar()`."""
    conn = engine.connect()
    transaccion = conn.begin()
    conn.execute(text("SELECT codigo FROM rol WHERE codigo = 'ADMIN' FOR UPDATE"))

    def cerrar() -> None:
        transaccion.rollback()
        conn.close()

    return cerrar


def _en_paralelo(
    engine: Engine, pedidos: list[Callable[[TestClient], int]], *, retener_bloqueo_seg: float = 0.0
) -> list[int]:
    """Ejecuta cada pedido desde un hilo propio (sesión propia, arranque sincronizado); devuelve los status en orden.

    Con `retener_bloqueo_seg` > 0 una conexión aparte retiene el bloqueo del rol `ADMIN` ese tiempo después de arrancar
    los hilos: así los dos pedidos llegan a la verificación casi a la vez y el resultado no depende de la suerte del reloj.
    """
    app.dependency_overrides[get_session] = _sesion_propia(engine)
    barrera = threading.Barrier(len(pedidos))
    status: list[int | None] = [None] * len(pedidos)
    errores: list[BaseException] = []

    def correr(indice: int, pedido: Callable[[TestClient], int]) -> None:
        try:
            with TestClient(app) as cliente:
                barrera.wait(timeout=10)
                status[indice] = pedido(cliente)
        except BaseException as exc:  # noqa: BLE001 - se reporta en el hilo principal
            errores.append(exc)

    cerrar = _retener_bloqueo_del_rol_admin(engine) if retener_bloqueo_seg else None
    try:
        hilos = [threading.Thread(target=correr, args=(i, p)) for i, p in enumerate(pedidos)]
        for hilo in hilos:
            hilo.start()
        if cerrar:
            hilos[0].join(timeout=retener_bloqueo_seg)
            cerrar()
            cerrar = None
        for hilo in hilos:
            hilo.join(timeout=30)
        assert all(not hilo.is_alive() for hilo in hilos), "posible deadlock: un hilo no terminó"
    finally:
        if cerrar:
            cerrar()
        app.dependency_overrides.clear()
    assert errores == []
    return [s for s in status if s is not None]


def test_dos_admin_quitandose_el_rol_a_la_vez_dejan_un_200_y_un_rechazo_y_un_admin_activo(escenario: Escenario) -> None:
    def a_quita_a_b(cliente: TestClient) -> int:
        return cliente.patch(f"{BASE}{escenario.admin_b.id}", json={"roles_codigos": ["CLIENT"]}, headers=escenario.headers_a).status_code

    def b_quita_a_a(cliente: TestClient) -> int:
        return cliente.patch(f"{BASE}{escenario.admin_a.id}", json={"roles_codigos": ["CLIENT"]}, headers=escenario.headers_b).status_code

    status = _en_paralelo(escenario.engine, [a_quita_a_b, b_quita_a_a], retener_bloqueo_seg=1.5)

    assert sorted(status)[0] == 200
    assert sorted(status)[1] in (403, 409)
    assert len(escenario.admins_activos()) == 1


def test_dos_admin_desactivandose_mutuamente_a_la_vez_dejan_un_admin_activo(escenario: Escenario) -> None:
    def a_desactiva_a_b(cliente: TestClient) -> int:
        return cliente.delete(f"{BASE}{escenario.admin_b.id}", headers=escenario.headers_a).status_code

    def b_desactiva_a_a(cliente: TestClient) -> int:
        return cliente.delete(f"{BASE}{escenario.admin_a.id}", headers=escenario.headers_b).status_code

    status = _en_paralelo(escenario.engine, [a_desactiva_a_b, b_desactiva_a_a], retener_bloqueo_seg=1.5)

    assert sorted(status)[0] == 204
    assert sorted(status)[1] in (403, 404, 409)
    assert len(escenario.admins_activos()) == 1


def _pedido_en_hilo(engine: Engine, pedido: Callable[[TestClient], int]) -> tuple[threading.Thread, list[int]]:
    resultado: list[int] = []
    app.dependency_overrides[get_session] = _sesion_propia(engine)

    def correr() -> None:
        with TestClient(app) as cliente:
            resultado.append(pedido(cliente))

    hilo = threading.Thread(target=correr)
    hilo.start()
    return hilo, resultado


def test_desactivar_a_un_cliente_no_espera_el_bloqueo_del_rol_admin(escenario: Escenario) -> None:
    cerrar = _retener_bloqueo_del_rol_admin(escenario.engine)
    try:
        hilo, resultado = _pedido_en_hilo(
            escenario.engine, lambda c: c.delete(f"{BASE}{escenario.cliente_id}", headers=escenario.headers_a).status_code
        )
        hilo.join(timeout=10)
        termino = not hilo.is_alive()
    finally:
        cerrar()
        app.dependency_overrides.clear()

    assert termino, "desactivar a un CLIENT quedó esperando el bloqueo del rol ADMIN"
    assert resultado == [204]


def test_desactivar_a_un_admin_espera_el_bloqueo_del_rol_admin_hasta_que_se_libera(escenario: Escenario) -> None:
    cerrar = _retener_bloqueo_del_rol_admin(escenario.engine)
    try:
        hilo, resultado = _pedido_en_hilo(
            escenario.engine, lambda c: c.delete(f"{BASE}{escenario.admin_b.id}", headers=escenario.headers_a).status_code
        )
        hilo.join(timeout=1.5)
        esperaba = hilo.is_alive()
    finally:
        cerrar()
    hilo.join(timeout=15)
    app.dependency_overrides.clear()

    assert esperaba, "desactivar a un ADMIN no tomó el bloqueo del rol ADMIN"
    assert resultado == [204]
