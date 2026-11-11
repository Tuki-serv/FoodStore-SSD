"""Contrato HTTP de pedidos (C-11, spec `order-api`): listado por alcance, detalle, historial, estado y cancelación."""
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.modules.pedidos.models import Pedido

PEDIDOS_URL = "/api/v1/pedidos"


def crear_pedido_http(client: TestClient, headers: dict, producto_id: int, cantidad: int = 1) -> int:
    """Crea un pedido EFECTIVO por HTTP y devuelve su id."""
    response = client.post(
        f"{PEDIDOS_URL}/",
        json={"forma_pago_codigo": "EFECTIVO", "items": [{"producto_id": producto_id, "cantidad": cantidad}]},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def fijar_created_at(session: Session, pedido_id: int, cuando: datetime) -> None:
    pedido = session.get(Pedido, pedido_id)
    pedido.created_at = cuando
    session.add(pedido)
    session.commit()


@pytest.fixture(name="dos_clientes")
def dos_clientes_fixture(usuario_con_roles):
    """Cliente A y cliente B: `((id_a, headers_a), (id_b, headers_b))`."""
    return usuario_con_roles(["CLIENT"]), usuario_con_roles(["CLIENT"])


class TestListadoPorAlcance:
    def test_cliente_ve_solo_sus_pedidos_con_resumen_sin_items(self, client, dos_clientes, producto_db):
        (id_a, headers_a), (_, headers_b) = dos_clientes
        for _ in range(2):
            crear_pedido_http(client, headers_a, producto_db.id)
        for _ in range(3):
            crear_pedido_http(client, headers_b, producto_db.id)

        response = client.get(PEDIDOS_URL, headers=headers_a)

        assert response.status_code == 200
        cuerpo = response.json()
        assert cuerpo["total"] == 2
        assert len(cuerpo["items"]) == 2
        for elemento in cuerpo["items"]:
            assert elemento["usuario_id"] == id_a
            assert elemento["cliente_nombre"] == "Rbac"
            assert "items" not in elemento

    def test_pedidos_ve_todos(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), (_, headers_b) = dos_clientes
        _, headers_pedidos = usuario_con_roles(["PEDIDOS"])
        for _ in range(2):
            crear_pedido_http(client, headers_a, producto_db.id)
        for _ in range(3):
            crear_pedido_http(client, headers_b, producto_db.id)

        cuerpo = client.get(PEDIDOS_URL, headers=headers_pedidos).json()

        assert cuerpo["total"] == 5

    def test_usuario_client_y_pedidos_ve_todos_por_union_de_roles(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_mixto = usuario_con_roles(["CLIENT", "PEDIDOS"])
        crear_pedido_http(client, headers_a, producto_db.id)
        crear_pedido_http(client, headers_mixto, producto_db.id)

        assert client.get(PEDIDOS_URL, headers=headers_mixto).json()["total"] == 2

    def test_rol_sin_acceso_al_listado_es_403(self, client, usuario_con_roles):
        _, headers_stock = usuario_con_roles(["STOCK"])
        assert client.get(PEDIDOS_URL, headers=headers_stock).status_code == 403

    def test_listado_ordenado_del_mas_nuevo_al_mas_viejo(self, client, session, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        ids = [crear_pedido_http(client, headers_a, producto_db.id) for _ in range(3)]
        fijar_created_at(session, ids[0], datetime(2026, 1, 3, tzinfo=timezone.utc))
        fijar_created_at(session, ids[1], datetime(2026, 1, 1, tzinfo=timezone.utc))
        fijar_created_at(session, ids[2], datetime(2026, 1, 2, tzinfo=timezone.utc))

        items = client.get(PEDIDOS_URL, headers=headers_a).json()["items"]

        assert [p["id"] for p in items] == [ids[0], ids[2], ids[1]]

    def test_paginacion_calcula_pages(self, client, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        for _ in range(5):
            crear_pedido_http(client, headers_a, producto_db.id)

        cuerpo = client.get(f"{PEDIDOS_URL}?page=2&size=2", headers=headers_a).json()

        assert (cuerpo["page"], cuerpo["size"], cuerpo["total"], cuerpo["pages"]) == (2, 2, 5, 3)
        assert len(cuerpo["items"]) == 2

    def test_filtro_por_estado(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pendiente = crear_pedido_http(client, headers_a, producto_db.id)
        confirmado = crear_pedido_http(client, headers_a, producto_db.id)
        assert client.patch(f"{PEDIDOS_URL}/{confirmado}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin).status_code == 200

        cuerpo = client.get(f"{PEDIDOS_URL}?estado=PENDIENTE", headers=headers_a).json()

        assert [p["id"] for p in cuerpo["items"]] == [pendiente]
        assert cuerpo["total"] == 1

    def test_filtro_de_fechas_es_inclusivo_en_ambos_extremos(self, client, session, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        antes, inicio, fin, despues = (crear_pedido_http(client, headers_a, producto_db.id) for _ in range(4))
        fijar_created_at(session, antes, datetime(2026, 3, 9, 23, 59, 59, tzinfo=timezone.utc))
        fijar_created_at(session, inicio, datetime(2026, 3, 10, 0, 0, 0, tzinfo=timezone.utc))
        fijar_created_at(session, fin, datetime(2026, 3, 12, 23, 59, 59, tzinfo=timezone.utc))
        fijar_created_at(session, despues, datetime(2026, 3, 13, 0, 0, 0, tzinfo=timezone.utc))

        cuerpo = client.get(f"{PEDIDOS_URL}?desde=2026-03-10&hasta=2026-03-12", headers=headers_a).json()

        assert sorted(p["id"] for p in cuerpo["items"]) == sorted([inicio, fin])
        assert cuerpo["total"] == 2

    def test_filtros_no_amplian_el_alcance_del_cliente(self, client, dos_clientes, producto_db):
        (_, headers_a), (_, headers_b) = dos_clientes
        crear_pedido_http(client, headers_b, producto_db.id)

        assert client.get(f"{PEDIDOS_URL}?estado=PENDIENTE", headers=headers_a).json()["total"] == 0

    def test_estado_invalido_es_422_con_field_estado(self, client, dos_clientes):
        (_, headers_a), _ = dos_clientes
        response = client.get(f"{PEDIDOS_URL}?estado=DESPACHADO", headers=headers_a)
        assert response.status_code == 422
        assert response.json()["field"] == "estado"


class TestDetalleEHistorial:
    def test_dueno_ve_el_detalle_con_items_y_otro_cliente_recibe_403(self, client, dos_clientes, producto_db):
        (id_a, headers_a), (_, headers_b) = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id, cantidad=2)

        propio = client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a)
        ajeno = client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_b)

        assert propio.status_code == 200
        cuerpo = propio.json()
        assert cuerpo["usuario_id"] == id_a
        assert "direccion_id" in cuerpo
        assert [(i["producto_id"], i["cantidad"]) for i in cuerpo["items"]] == [(producto_db.id, 2)]
        assert ajeno.status_code == 403

    def test_pedidos_ve_el_detalle_de_un_cliente(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_pedidos = usuario_con_roles(["PEDIDOS"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        assert client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_pedidos).status_code == 200

    def test_detalle_de_pedido_inexistente_es_404_con_codigo_http_404(self, client, dos_clientes):
        (_, headers_a), _ = dos_clientes
        response = client.get(f"{PEDIDOS_URL}/999999", headers=headers_a)
        assert response.status_code == 404
        assert response.json()["code"] == "HTTP_404"

    def test_detalle_ajeno_devuelve_403_con_el_formato_unico(self, client, dos_clientes, producto_db):
        (_, headers_a), (_, headers_b) = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
        cuerpo = client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_b).json()
        assert cuerpo["code"] == "HTTP_403"
        assert cuerpo["field"] is None

    def test_historial_del_dueno_trae_la_fila_inicial_y_el_ajeno_recibe_403(self, client, dos_clientes, producto_db):
        (id_a, headers_a), (_, headers_b) = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        propio = client.get(f"{PEDIDOS_URL}/{pedido_id}/historial", headers=headers_a)
        ajeno = client.get(f"{PEDIDOS_URL}/{pedido_id}/historial", headers=headers_b)

        assert propio.status_code == 200
        filas = propio.json()
        assert [(f["estado_desde"], f["estado_hacia"], f["usuario_id"]) for f in filas] == [(None, "PENDIENTE", id_a)]
        assert ajeno.status_code == 403

    def test_historial_inexistente_es_404_y_pedidos_lo_ve(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_pedidos = usuario_con_roles(["PEDIDOS"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        assert client.get(f"{PEDIDOS_URL}/999999/historial", headers=headers_pedidos).status_code == 404
        assert client.get(f"{PEDIDOS_URL}/{pedido_id}/historial", headers=headers_pedidos).status_code == 200


class TestCambioDeEstado:
    def _pedido_confirmado(self, client, headers_cliente, headers_admin, producto_id) -> int:
        pedido_id = crear_pedido_http(client, headers_cliente, producto_id)
        r = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin)
        assert r.status_code == 200, r.text
        return pedido_id

    def test_patch_con_nuevo_estado_devuelve_el_detalle(self, client, dos_clientes, usuario_con_roles, producto_db):
        (id_a, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = self._pedido_confirmado(client, headers_a, headers_admin, producto_db.id)

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "EN_PREP"}, headers=headers_admin)

        assert response.status_code == 200
        cuerpo = response.json()
        assert cuerpo["estado_codigo"] == "EN_PREP"
        assert cuerpo["usuario_id"] == id_a
        assert [i["producto_id"] for i in cuerpo["items"]] == [producto_db.id]

    def test_el_campo_viejo_estado_hacia_es_422_con_field_nuevo_estado(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = self._pedido_confirmado(client, headers_a, headers_admin, producto_db.id)

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"estado_hacia": "EN_PREP"}, headers=headers_admin)

        assert response.status_code == 422
        assert response.json()["field"] == "nuevo_estado"

    def test_cancelar_sin_motivo_es_422_con_field_motivo_y_no_cambia(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CANCELADO"}, headers=headers_admin)

        assert response.status_code == 422
        assert response.json()["field"] == "motivo"
        assert client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a).json()["estado_codigo"] == "PENDIENTE"

    def test_transicion_invalida_responde_409_con_codigo_invalid_transition(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = self._pedido_confirmado(client, headers_a, headers_admin, producto_db.id)
        assert client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "EN_PREP"}, headers=headers_admin).status_code == 200

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "ENTREGADO"}, headers=headers_admin)

        assert response.status_code == 409
        assert response.json()["code"] == "INVALID_TRANSITION"
        assert response.json()["detail"] == "No se puede cambiar de EN_PREP a ENTREGADO"

    def test_pedido_terminal_responde_409_invalid_transition(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
        client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CANCELADO", "motivo": "x"}, headers=headers_admin)

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin)

        assert response.status_code == 409
        assert response.json()["code"] == "INVALID_TRANSITION"

    def test_confirmar_sin_stock_responde_409_con_codigo_insufficient_stock(
        self, client, session, dos_clientes, usuario_con_roles, producto_db
    ):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id, cantidad=5)
        producto_db.stock_cantidad = 1
        session.add(producto_db)
        session.commit()

        response = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin)

        assert response.status_code == 409
        assert response.json()["code"] == "INSUFFICIENT_STOCK"


class TestDeleteCancelaElPedidoPropio:
    def _historial(self, client, headers, pedido_id):
        return client.get(f"{PEDIDOS_URL}/{pedido_id}/historial", headers=headers).json()

    def test_dueno_cancela_su_pedido_pendiente_con_motivo(self, client, dos_clientes, producto_db):
        (id_a, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.request("DELETE", f"{PEDIDOS_URL}/{pedido_id}", json={"motivo": "me arrepentí"}, headers=headers_a)

        assert response.status_code == 200
        assert response.json()["estado_codigo"] == "CANCELADO"
        ultima = self._historial(client, headers_a, pedido_id)[-1]
        assert (ultima["estado_desde"], ultima["estado_hacia"], ultima["motivo"], ultima["usuario_id"]) == (
            "PENDIENTE", "CANCELADO", "me arrepentí", id_a,
        )

    def test_pedido_ajeno_es_403_y_no_cambia(self, client, dos_clientes, producto_db):
        (_, headers_a), (_, headers_b) = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.request("DELETE", f"{PEDIDOS_URL}/{pedido_id}", json={"motivo": "x"}, headers=headers_b)

        assert response.status_code == 403
        assert client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a).json()["estado_codigo"] == "PENDIENTE"

    def test_pedido_inexistente_es_404(self, client, dos_clientes):
        (_, headers_a), _ = dos_clientes
        assert client.request("DELETE", f"{PEDIDOS_URL}/999999", json={"motivo": "x"}, headers=headers_a).status_code == 404

    def test_sin_body_cancela_con_el_motivo_por_defecto(self, client, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.delete(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a)

        assert response.status_code == 200
        assert response.json()["estado_codigo"] == "CANCELADO"
        assert self._historial(client, headers_a, pedido_id)[-1]["motivo"] == "Cancelado por el cliente"

    @pytest.mark.parametrize("body", [{"motivo": "   "}, {"motivo": ""}, {}, {"motivo": None}])
    def test_body_con_motivo_vacio_o_ausente_usa_el_motivo_por_defecto(self, client, dos_clientes, producto_db, body):
        (_, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.request("DELETE", f"{PEDIDOS_URL}/{pedido_id}", json=body, headers=headers_a)

        assert response.status_code == 200
        assert self._historial(client, headers_a, pedido_id)[-1]["motivo"] == "Cancelado por el cliente"

    def test_solo_admin_recibe_403_y_el_pedido_no_se_cancela_ni_se_marca_eliminado(
        self, client, session, dos_clientes, usuario_con_roles, producto_db
    ):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.request("DELETE", f"{PEDIDOS_URL}/{pedido_id}", json={"motivo": "x"}, headers=headers_admin)

        assert response.status_code == 403
        session.expire_all()
        pedido = session.get(Pedido, pedido_id)
        assert pedido.estado_codigo == "PENDIENTE"
        assert pedido.deleted_at is None

    def test_cliente_no_puede_cancelar_en_preparacion_409(self, client, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
        for destino in ("CONFIRMADO", "EN_PREP"):
            client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": destino}, headers=headers_admin)

        response = client.delete(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a)

        assert response.status_code == 409
        assert response.json()["code"] == "INVALID_TRANSITION"

    def test_cliente_y_admin_pueden_cancelar_su_pedido_en_preparacion(self, client, usuario_con_roles, producto_db):
        _, headers_mixto = usuario_con_roles(["CLIENT", "ADMIN"])
        pedido_id = crear_pedido_http(client, headers_mixto, producto_db.id)
        for destino in ("CONFIRMADO", "EN_PREP"):
            client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": destino}, headers=headers_mixto)

        response = client.delete(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_mixto)

        assert response.status_code == 200
        assert response.json()["estado_codigo"] == "CANCELADO"

    def test_cancelar_un_confirmado_devuelve_el_stock(self, client, session, dos_clientes, usuario_con_roles, producto_db):
        (_, headers_a), _ = dos_clientes
        _, headers_admin = usuario_con_roles(["ADMIN"])
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id, cantidad=4)
        client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin)
        session.expire_all()
        assert session.get(type(producto_db), producto_db.id).stock_cantidad == 96

        assert client.delete(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a).status_code == 200

        session.expire_all()
        assert session.get(type(producto_db), producto_db.id).stock_cantidad == 100

    def test_pedido_cancelado_sigue_visible_en_detalle_y_listado(self, client, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
        client.delete(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a)

        detalle = client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a)
        listado = client.get(PEDIDOS_URL, headers=headers_a).json()

        assert detalle.status_code == 200
        assert [p["id"] for p in listado["items"]] == [pedido_id]


class TestRutasRetiradas:
    def test_mis_pedidos_ya_no_responde_200(self, client, dos_clientes):
        (_, headers_a), _ = dos_clientes
        assert client.get(f"{PEDIDOS_URL}/mis-pedidos", headers=headers_a).status_code != 200

    def test_cancelar_por_la_ruta_vieja_no_responde_200_y_no_cambia_el_pedido(self, client, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)

        response = client.patch(
            f"{PEDIDOS_URL}/mis-pedidos/{pedido_id}/cancelar",
            json={"nuevo_estado": "CANCELADO", "motivo": "x"},
            headers=headers_a,
        )

        assert response.status_code != 200
        assert client.get(f"{PEDIDOS_URL}/{pedido_id}", headers=headers_a).json()["estado_codigo"] == "PENDIENTE"

    def test_detalle_por_la_ruta_vieja_no_responde_200(self, client, dos_clientes, producto_db):
        (_, headers_a), _ = dos_clientes
        pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
        assert client.get(f"{PEDIDOS_URL}/mis-pedidos/{pedido_id}", headers=headers_a).status_code != 200


class TestListadoDeCocina:
    def test_filtra_antes_de_paginar_y_ordena_del_mas_viejo_al_mas_nuevo(
        self, client, session, usuario_con_roles, dos_clientes, producto_db
    ):
        (_, headers_a), _ = dos_clientes
        _, headers_cocina = usuario_con_roles(["COCINA"])
        _, headers_admin = usuario_con_roles(["ADMIN"])
        confirmados = [crear_pedido_http(client, headers_a, producto_db.id) for _ in range(3)]
        for pedido_id in confirmados:
            r = client.patch(f"{PEDIDOS_URL}/{pedido_id}/estado", json={"nuevo_estado": "CONFIRMADO"}, headers=headers_admin)
            assert r.status_code == 200
        for _ in range(25):
            pedido_id = crear_pedido_http(client, headers_a, producto_db.id)
            fijar_created_at(session, pedido_id, datetime(2026, 5, 1, tzinfo=timezone.utc))
            pedido = session.get(Pedido, pedido_id)
            pedido.estado_codigo = "ENTREGADO"
            session.add(pedido)
        session.commit()
        for indice, pedido_id in enumerate(reversed(confirmados)):
            fijar_created_at(session, pedido_id, datetime(2026, 1, 1 + indice, tzinfo=timezone.utc))

        response = client.get(f"{PEDIDOS_URL}/cocina/pedidos", headers=headers_cocina)

        assert response.status_code == 200
        cuerpo = response.json()
        assert cuerpo["total"] == 3
        assert cuerpo["pages"] == 1
        assert [p["id"] for p in cuerpo["items"]] == list(reversed(confirmados))
        assert all(p["estado_codigo"] == "CONFIRMADO" for p in cuerpo["items"])
        assert all("items" not in p for p in cuerpo["items"])
