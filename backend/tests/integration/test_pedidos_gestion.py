"""C-22 (spec `order-api`): dirección de entrega en el detalle y autor en el historial, para el tablero de gestión."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.direcciones.models import DireccionEntrega
from app.modules.pedidos.models import HistorialEstadoPedido
from app.modules.pedidos.repository import HistorialEstadoPedidoRepository, HistorialInmutableError
from app.modules.usuarios.models import Usuario
from tests.support.auth_helpers import bearer_de_usuario, crear_usuario_con_roles
from tests.support.pagos_factory import pedido_sin_pagos

PEDIDOS_URL = "/api/v1/pedidos"


def _cliente(session: Session):
    usuario = crear_usuario_con_roles(session, ["CLIENT"])
    return usuario.id, bearer_de_usuario(session, usuario, ["CLIENT"])


def _gestor(session: Session, roles: list[str], nombre: str | None = None):
    usuario = crear_usuario_con_roles(session, roles)
    if nombre is not None:
        usuario.nombre = nombre
        session.add(usuario)
        session.commit()
    return usuario.id, bearer_de_usuario(session, usuario, roles)


def _direccion(client: TestClient, headers: dict, **campos) -> int:
    cuerpo = {"alias": "Casa", "linea1": "Av. Siempre Viva 742", "ciudad": "Springfield", **campos}
    respuesta = client.post("/api/v1/direcciones/", json=cuerpo, headers=headers)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["id"]


def _pedido(client: TestClient, headers: dict, producto_id: int, direccion_id: int | None = None, forma: str = "EFECTIVO"):
    cuerpo = {"forma_pago_codigo": forma, "items": [{"producto_id": producto_id, "cantidad": 1}]}
    if direccion_id is not None:
        cuerpo["direccion_id"] = direccion_id
    respuesta = client.post(f"{PEDIDOS_URL}/", json=cuerpo, headers=headers)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


class TestDireccionEnElDetalle:
    def test_gestor_ve_la_direccion_de_un_pedido_ajeno(self, client, session, producto_db):
        _, headers_cliente = _cliente(session)
        direccion_id = _direccion(client, headers_cliente, provincia="Oregon", codigo_postal="97000")
        pedido = _pedido(client, headers_cliente, producto_db.id, direccion_id)
        _, headers_gestor = _gestor(session, ["PEDIDOS"])

        respuesta = client.get(f"{PEDIDOS_URL}/{pedido['id']}", headers=headers_gestor)

        assert respuesta.status_code == 200
        assert respuesta.json()["direccion"] == {
            "id": direccion_id,
            "alias": "Casa",
            "linea1": "Av. Siempre Viva 742",
            "linea2": None,
            "ciudad": "Springfield",
            "provincia": "Oregon",
            "codigo_postal": "97000",
        }

    def test_el_duenio_tambien_recibe_la_direccion(self, client, session, producto_db):
        _, headers = _cliente(session)
        direccion_id = _direccion(client, headers, alias="Trabajo", linea1="Calle 9", ciudad="Mendoza")
        pedido = _pedido(client, headers, producto_db.id, direccion_id)

        cuerpo = client.get(f"{PEDIDOS_URL}/{pedido['id']}", headers=headers).json()

        assert (cuerpo["direccion"]["alias"], cuerpo["direccion"]["linea1"], cuerpo["direccion"]["ciudad"]) == (
            "Trabajo",
            "Calle 9",
            "Mendoza",
        )

    def test_pedido_para_retirar_trae_direccion_nula(self, client, session, producto_db):
        _, headers = _cliente(session)
        pedido = _pedido(client, headers, producto_db.id)
        _, headers_admin = _gestor(session, ["ADMIN"])

        respuesta = client.get(f"{PEDIDOS_URL}/{pedido['id']}", headers=headers_admin)

        assert respuesta.status_code == 200
        assert respuesta.json()["direccion"] is None
        assert respuesta.json()["direccion_id"] is None

    def test_direccion_borrada_despues_del_pedido_sigue_visible(self, client, session, producto_db):
        _, headers = _cliente(session)
        direccion_id = _direccion(client, headers)
        pedido = _pedido(client, headers, producto_db.id, direccion_id)
        direccion = session.get(DireccionEntrega, direccion_id)
        direccion.deleted_at = datetime.now(timezone.utc)
        session.add(direccion)
        session.commit()
        _, headers_gestor = _gestor(session, ["PEDIDOS"])

        cuerpo = client.get(f"{PEDIDOS_URL}/{pedido['id']}", headers=headers_gestor).json()

        assert cuerpo["direccion"]["linea1"] == "Av. Siempre Viva 742"

    def test_crear_y_cambiar_estado_devuelven_el_detalle_con_direccion(self, client, session, producto_db):
        _, headers = _cliente(session)
        direccion_id = _direccion(client, headers)
        creado = _pedido(client, headers, producto_db.id, direccion_id)
        _, headers_gestor = _gestor(session, ["PEDIDOS"])

        confirmado = client.patch(
            f"{PEDIDOS_URL}/{creado['id']}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_gestor
        )

        assert creado["direccion"]["ciudad"] == "Springfield"
        assert confirmado.status_code == 200
        assert confirmado.json()["direccion"]["ciudad"] == "Springfield"


class TestAutorEnElHistorial:
    def test_confirmacion_manual_trae_el_nombre_de_la_gestora(self, client, session, producto_db):
        _, headers = _cliente(session)
        pedido = _pedido(client, headers, producto_db.id)
        gestora_id, headers_gestora = _gestor(session, ["PEDIDOS"], nombre="Carla")
        client.patch(f"{PEDIDOS_URL}/{pedido['id']}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_gestora)

        historial = client.get(f"{PEDIDOS_URL}/{pedido['id']}/historial", headers=headers_gestora).json()

        fila = historial[1]
        assert (fila["estado_desde"], fila["estado_hacia"]) == ("PENDIENTE", "CONFIRMADO")
        assert fila["usuario_nombre"] == "Carla"
        assert fila["usuario_id"] == gestora_id

    def test_fila_inicial_trae_el_nombre_del_cliente_y_el_orden_se_mantiene(self, client, session, producto_db):
        cliente_id, headers = _cliente(session)
        pedido = _pedido(client, headers, producto_db.id)
        _, headers_gestor = _gestor(session, ["ADMIN"], nombre="Dora")
        for destino in ("CONFIRMADO", "EN_PREP", "EN_CAMINO"):
            client.patch(f"{PEDIDOS_URL}/{pedido['id']}/estado", json={"nuevo_estado": destino}, headers=headers_gestor)

        historial = client.get(f"{PEDIDOS_URL}/{pedido['id']}/historial", headers=headers).json()

        assert [f["estado_hacia"] for f in historial] == ["PENDIENTE", "CONFIRMADO", "EN_PREP", "EN_CAMINO"]
        assert historial[0]["usuario_nombre"] == session.get(Usuario, cliente_id).nombre
        assert [f["usuario_nombre"] for f in historial[1:]] == ["Dora"] * 3

    def test_cambio_del_sistema_no_trae_usuario(self, client, session):
        cliente_id, headers = _cliente(session)
        pedido = pedido_sin_pagos(session, cliente_id, "PENDIENTE", "MERCADOPAGO")
        session.add(
            HistorialEstadoPedido(pedido_id=pedido.id, estado_desde="PENDIENTE", estado_hacia="CONFIRMADO", usuario_id=None)
        )
        session.commit()

        historial = client.get(f"{PEDIDOS_URL}/{pedido.id}/historial", headers=headers).json()

        assert historial[0]["usuario_id"] is None
        assert historial[0]["usuario_nombre"] is None

    def test_repositorio_de_historial_sigue_siendo_append_only(self, session):
        repo = HistorialEstadoPedidoRepository(session)

        with pytest.raises(HistorialInmutableError):
            repo.update(None)
        with pytest.raises(HistorialInmutableError):
            repo.delete(None)
