"""Administración de usuarios por ADMIN (C-23, spec `user-administration`): alta/edición con roles, listado, baja y protecciones."""
from datetime import datetime, timedelta, timezone
from itertools import count

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select
from uuid import uuid4

from app.modules.refreshtokens.models import Sesion
from app.modules.usuarios.models import Usuario, UsuarioRol
from tests.support.auth_helpers import bearer_con_roles, bearer_de_usuario, crear_usuario_con_roles, iniciar_sesion, renovar

ALTA = "/api/v1/admin/usuarios/createUser"
LISTADO = "/api/v1/admin/usuarios/"
PASSWORD = "SecurePass123!"

_secuencia = count(1)


def _alta_datos(**cambios: object) -> dict:
    n = next(_secuencia)
    base = {
        "nombre": "Carla",
        "apellido": "Gómez",
        "email": f"carla{n}@example.com",
        "password": PASSWORD,
        "roles_codigos": ["CLIENT"],
    }
    return {**base, **cambios}


def _crear(client: TestClient, headers: dict, **cambios: object) -> dict:
    response = client.post(ALTA, json=_alta_datos(**cambios), headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def _codigos(usuario: dict) -> list[str]:
    return sorted(rol["codigo"] for rol in usuario["roles"])


def _asignaciones(session: Session, usuario_id: int) -> dict[str, UsuarioRol]:
    session.expire_all()
    filas = session.exec(select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id)).all()
    return {fila.rol_codigo: fila for fila in filas}


def _admin_id(session: Session) -> int:
    return session.exec(select(Usuario.id).where(Usuario.email == "admin@foodstore.com")).one()


def _cantidad_usuarios(session: Session) -> int:
    return session.exec(select(func.count()).select_from(Usuario)).one()


class TestAltaConVariosRoles:
    def test_alta_con_dos_roles_devuelve_201_con_ambos_y_permite_iniciar_sesion(self, client: TestClient, admin_auth_headers: dict):
        datos = _alta_datos(email="carla@example.com", roles_codigos=["PEDIDOS", "STOCK"])

        response = client.post(ALTA, json=datos, headers=admin_auth_headers)

        assert response.status_code == 201
        assert _codigos(response.json()) == ["PEDIDOS", "STOCK"]
        assert "password" not in response.json() and "password_hash" not in response.json()
        iniciar_sesion(client, {"email": "carla@example.com", "password": PASSWORD})

    def test_lista_vacia_devuelve_422_con_field_roles_codigos_y_no_crea_el_usuario(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        antes = _cantidad_usuarios(session)

        response = client.post(ALTA, json=_alta_datos(roles_codigos=[]), headers=admin_auth_headers)

        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert response.json()["field"] == "roles_codigos"
        assert _cantidad_usuarios(session) == antes

    def test_codigos_repetidos_se_tratan_como_uno(self, client: TestClient, admin_auth_headers: dict):
        response = client.post(ALTA, json=_alta_datos(roles_codigos=["STOCK", "STOCK"]), headers=admin_auth_headers)

        assert response.status_code == 201
        assert [rol["codigo"] for rol in response.json()["roles"]] == ["STOCK"]

    def test_rol_inexistente_en_el_alta_devuelve_400_y_no_crea_el_usuario(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        antes = _cantidad_usuarios(session)

        response = client.post(ALTA, json=_alta_datos(roles_codigos=["CLIENT", "NOEXISTE"]), headers=admin_auth_headers)

        assert response.status_code == 400
        assert _cantidad_usuarios(session) == antes

    def test_el_alta_registra_al_admin_como_asignador_de_cada_rol(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        creado = _crear(client, admin_auth_headers, roles_codigos=["PEDIDOS", "STOCK"])

        asignaciones = _asignaciones(session, creado["id"])

        assert set(asignaciones) == {"PEDIDOS", "STOCK"}
        assert {a.asignado_por_id for a in asignaciones.values()} == {_admin_id(session)}


class TestEdicionDeRoles:
    def test_roles_codigos_vacio_en_la_edicion_devuelve_422(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers, roles_codigos=["STOCK"])

        response = client.patch(f"{LISTADO}{creado['id']}", json={"roles_codigos": []}, headers=admin_auth_headers)

        assert response.status_code == 422
        assert response.json()["field"] == "roles_codigos"

    def test_roles_codigos_null_explicito_devuelve_422_y_conserva_los_roles(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers, roles_codigos=["STOCK"])

        response = client.patch(f"{LISTADO}{creado['id']}", json={"roles_codigos": None}, headers=admin_auth_headers)

        assert response.status_code == 422
        assert response.json()["field"] == "roles_codigos"
        listado = client.get(LISTADO, headers=admin_auth_headers).json()["items"]
        assert _codigos(next(u for u in listado if u["id"] == creado["id"])) == ["STOCK"]

    def test_rol_conservado_mantiene_su_asignacion_y_el_nuevo_registra_al_actor(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        creado = _crear(client, admin_auth_headers, roles_codigos=["PEDIDOS"])
        original = _asignaciones(session, creado["id"])["PEDIDOS"]
        # el rol PEDIDOS lo asignó el admin de la fixture; la edición la hace otro admin para distinguir al actor
        otro_admin = crear_usuario_con_roles(session, ["ADMIN"])
        otro_headers = bearer_de_usuario(otro_admin, ["ADMIN"])
        asignado_original = original.asignado_por_id
        creado_en = original.created_at

        response = client.patch(
            f"{LISTADO}{creado['id']}", json={"roles_codigos": ["PEDIDOS", "STOCK"]}, headers=otro_headers
        )

        assert response.status_code == 200
        asignaciones = _asignaciones(session, creado["id"])
        assert asignaciones["PEDIDOS"].asignado_por_id == asignado_original == _admin_id(session)
        assert asignaciones["PEDIDOS"].created_at == creado_en
        assert asignaciones["STOCK"].asignado_por_id == otro_admin.id

    def test_reemplazo_quita_los_roles_que_no_estan_y_el_siguiente_pedido_recibe_403(
        self, client: TestClient, admin_auth_headers: dict, usuario_con_roles
    ):
        usuario_id, headers = usuario_con_roles(["CLIENT", "STOCK"])

        response = client.patch(f"{LISTADO}{usuario_id}", json={"roles_codigos": ["CLIENT"]}, headers=admin_auth_headers)

        assert response.status_code == 200
        assert _codigos(response.json()) == ["CLIENT"]
        assert client.patch("/api/v1/productos/1/stock", json={"cantidad": 1}, headers=headers).status_code == 403

    def test_rol_inexistente_en_la_edicion_devuelve_400_sin_cambios(
        self, client: TestClient, admin_auth_headers: dict, usuario_con_roles
    ):
        usuario_id, _ = usuario_con_roles(["STOCK"])

        response = client.patch(
            f"{LISTADO}{usuario_id}", json={"roles_codigos": ["CLIENT", "NOEXISTE"]}, headers=admin_auth_headers
        )

        assert response.status_code == 400
        listado = client.get(LISTADO, headers=admin_auth_headers).json()["items"]
        assert _codigos(next(u for u in listado if u["id"] == usuario_id)) == ["STOCK"]

    def test_edicion_solo_de_celular_conserva_los_roles(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers, roles_codigos=["PEDIDOS"])

        response = client.patch(f"{LISTADO}{creado['id']}", json={"celular": "1155550000"}, headers=admin_auth_headers)

        assert response.status_code == 200
        assert response.json()["celular"] == "1155550000"
        assert _codigos(response.json()) == ["PEDIDOS"]

    def test_edicion_de_usuario_desactivado_devuelve_404(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers)
        assert client.delete(f"{LISTADO}{creado['id']}", headers=admin_auth_headers).status_code == 204

        response = client.patch(f"{LISTADO}{creado['id']}", json={"celular": "1"}, headers=admin_auth_headers)

        assert response.status_code == 404

    def test_edicion_de_usuario_inexistente_devuelve_404(self, client: TestClient, admin_auth_headers: dict):
        assert client.patch(f"{LISTADO}999999", json={"celular": "1"}, headers=admin_auth_headers).status_code == 404


def _sesion_abierta(session: Session, usuario_id: int) -> Sesion:
    ahora = datetime.now(timezone.utc)
    sesion = Sesion(id=uuid4(), usuario_id=usuario_id, expires_at=ahora + timedelta(days=7))
    session.add(sesion)
    session.commit()
    return sesion


class TestBajaConCierreDeSesiones:
    def test_la_baja_cierra_las_sesiones_con_motivo_baja_y_el_refresh_responde_401(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        datos = _alta_datos(email="baja@example.com")
        assert client.post(ALTA, json=datos, headers=admin_auth_headers).status_code == 201
        usuario = {"email": datos["email"], "password": PASSWORD}
        primera = iniciar_sesion(client, usuario)
        refresh_1 = client.cookies.get("refresh_token")
        segunda = iniciar_sesion(client, usuario)
        refresh_2 = client.cookies.get("refresh_token")
        usuario_id = session.exec(select(Usuario.id).where(Usuario.email == datos["email"])).one()
        assert primera.status_code == segunda.status_code == 200

        response = client.delete(f"{LISTADO}{usuario_id}", headers=admin_auth_headers)

        assert response.status_code == 204
        session.expire_all()
        sesiones = session.exec(select(Sesion).where(Sesion.usuario_id == usuario_id)).all()
        assert len(sesiones) == 2
        assert {s.revoked_reason for s in sesiones} == {"BAJA"}
        assert renovar(client, refresh_1).status_code == 401
        assert renovar(client, refresh_2).status_code == 401

    def test_la_baja_no_toca_las_sesiones_de_otros_usuarios(self, client: TestClient, admin_auth_headers: dict, session: Session):
        ajena = _sesion_abierta(session, crear_usuario_con_roles(session, ["CLIENT"]).id)
        objetivo = _crear(client, admin_auth_headers)

        assert client.delete(f"{LISTADO}{objetivo['id']}", headers=admin_auth_headers).status_code == 204

        session.expire_all()
        assert session.get(Sesion, ajena.id).revoked_at is None

    def test_doble_desactivacion_devuelve_404_la_segunda_vez(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers)

        assert client.delete(f"{LISTADO}{creado['id']}", headers=admin_auth_headers).status_code == 204
        assert client.delete(f"{LISTADO}{creado['id']}", headers=admin_auth_headers).status_code == 404

    def test_el_email_del_desactivado_se_puede_reutilizar_en_un_alta_nueva(self, client: TestClient, admin_auth_headers: dict):
        creado = _crear(client, admin_auth_headers, email="ana@example.com")
        assert client.delete(f"{LISTADO}{creado['id']}", headers=admin_auth_headers).status_code == 204

        response = client.post(ALTA, json=_alta_datos(email="ana@example.com"), headers=admin_auth_headers)

        assert response.status_code == 201

    def test_desactivar_un_usuario_inexistente_devuelve_404(self, client: TestClient, admin_auth_headers: dict):
        assert client.delete(f"{LISTADO}999999", headers=admin_auth_headers).status_code == 404


class TestListadoPaginadoYFiltro:
    def test_segunda_pagina_trae_el_resto_y_el_desactivado_no_cuenta(
        self, client: TestClient, admin_auth_headers: dict, session: Session
    ):
        # 1 admin de la fixture + 24 = 25 activos, + 1 desactivado
        for _ in range(24):
            _crear(client, admin_auth_headers)
        desactivado = _crear(client, admin_auth_headers)
        assert client.delete(f"{LISTADO}{desactivado['id']}", headers=admin_auth_headers).status_code == 204

        response = client.get(f"{LISTADO}?page=2&size=20", headers=admin_auth_headers)

        cuerpo = response.json()
        assert response.status_code == 200
        assert (len(cuerpo["items"]), cuerpo["total"], cuerpo["pages"]) == (5, 25, 2)
        todos = client.get(f"{LISTADO}?page=1&size=20", headers=admin_auth_headers).json()["items"] + cuerpo["items"]
        assert desactivado["id"] not in {u["id"] for u in todos}

    def test_rol_desconocido_en_el_filtro_devuelve_400(self, client: TestClient, admin_auth_headers: dict):
        assert client.get(f"{LISTADO}?rol_codigo=NOEXISTE", headers=admin_auth_headers).status_code == 400

    def test_rol_valido_sin_coincidencias_devuelve_items_vacios_y_total_0(self, client: TestClient, admin_auth_headers: dict):
        response = client.get(f"{LISTADO}?rol_codigo=STOCK", headers=admin_auth_headers)

        assert response.status_code == 200
        assert (response.json()["items"], response.json()["total"]) == ([], 0)

    def test_usuario_con_dos_roles_aparece_una_vez_con_ambos_y_total_lo_cuenta_una_vez(
        self, client: TestClient, admin_auth_headers: dict
    ):
        carla = _crear(client, admin_auth_headers, roles_codigos=["PEDIDOS", "STOCK"])
        _crear(client, admin_auth_headers, roles_codigos=["CLIENT"])

        response = client.get(f"{LISTADO}?rol_codigo=STOCK", headers=admin_auth_headers)

        cuerpo = response.json()
        assert cuerpo["total"] == 1
        assert [u["id"] for u in cuerpo["items"]] == [carla["id"]]
        assert _codigos(cuerpo["items"][0]) == ["PEDIDOS", "STOCK"]

    def test_igual_created_at_se_ordena_por_id(self, client: TestClient, admin_auth_headers: dict, session: Session):
        ids = [_crear(client, admin_auth_headers)["id"] for _ in range(3)]
        instante = datetime(2030, 1, 1, tzinfo=timezone.utc)
        for usuario_id in reversed(ids):
            session.get(Usuario, usuario_id).created_at = instante
        session.commit()

        items = client.get(f"{LISTADO}?size=100", headers=admin_auth_headers).json()["items"]

        ordenados = [u["id"] for u in items if u["id"] in ids]
        assert ordenados == sorted(ids)


class TestProteccionDeLaPropiaCuenta:
    def _yo(self, session: Session) -> tuple[int, dict]:
        admin = crear_usuario_con_roles(session, ["ADMIN", "CLIENT"])
        return admin.id, bearer_de_usuario(admin, ["ADMIN", "CLIENT"])

    def test_autodesactivacion_devuelve_409_y_sigue_activo(self, client: TestClient, session: Session):
        yo, headers = self._yo(session)

        response = client.delete(f"{LISTADO}{yo}", headers=headers)

        assert response.status_code == 409
        assert response.json()["code"] == "SELF_ACTION_NOT_ALLOWED"
        session.expire_all()
        assert session.get(Usuario, yo).deleted_at is None

    def test_quitarse_el_rol_admin_devuelve_409_y_conserva_el_rol(self, client: TestClient, session: Session):
        yo, headers = self._yo(session)

        response = client.patch(f"{LISTADO}{yo}", json={"roles_codigos": ["CLIENT"]}, headers=headers)

        assert response.status_code == 409
        assert response.json()["code"] == "SELF_ACTION_NOT_ALLOWED"
        assert set(_asignaciones(session, yo)) == {"ADMIN", "CLIENT"}

    def test_agregarse_un_rol_y_conservar_admin_devuelve_200(self, client: TestClient, session: Session):
        yo, headers = self._yo(session)

        response = client.patch(f"{LISTADO}{yo}", json={"roles_codigos": ["ADMIN", "STOCK"]}, headers=headers)

        assert response.status_code == 200
        assert _codigos(response.json()) == ["ADMIN", "STOCK"]

    def test_editar_los_propios_datos_personales_sin_roles_devuelve_200(self, client: TestClient, session: Session):
        yo, headers = self._yo(session)

        response = client.patch(f"{LISTADO}{yo}", json={"celular": "1144443333"}, headers=headers)

        assert response.status_code == 200
        assert response.json()["celular"] == "1144443333"


class TestSiempreQuedaUnAdmin:
    def test_con_tres_admin_desactivar_a_uno_devuelve_204_y_quedan_dos(
        self, client: TestClient, admin_auth_headers: dict
    ):
        a = _crear(client, admin_auth_headers, roles_codigos=["ADMIN"])
        _crear(client, admin_auth_headers, roles_codigos=["ADMIN"])

        assert client.delete(f"{LISTADO}{a['id']}", headers=admin_auth_headers).status_code == 204

        assert client.get(f"{LISTADO}?rol_codigo=ADMIN", headers=admin_auth_headers).json()["total"] == 2

    def test_con_tres_admin_quitar_admin_a_otro_devuelve_200(self, client: TestClient, admin_auth_headers: dict):
        a = _crear(client, admin_auth_headers, roles_codigos=["ADMIN"])
        _crear(client, admin_auth_headers, roles_codigos=["ADMIN"])

        response = client.patch(f"{LISTADO}{a['id']}", json={"roles_codigos": ["CLIENT"]}, headers=admin_auth_headers)

        assert response.status_code == 200
        assert client.get(f"{LISTADO}?rol_codigo=ADMIN", headers=admin_auth_headers).json()["total"] == 2

    def test_quitar_admin_a_un_usuario_que_no_es_admin_no_cuenta_como_reduccion(
        self, client: TestClient, admin_auth_headers: dict
    ):
        stock = _crear(client, admin_auth_headers, roles_codigos=["STOCK"])

        response = client.patch(f"{LISTADO}{stock['id']}", json={"roles_codigos": ["CLIENT"]}, headers=admin_auth_headers)

        assert response.status_code == 200

    def test_el_ultimo_admin_activo_no_puede_perder_el_rol_por_otro_actor_sin_admin(self, client: TestClient, session: Session):
        """Un actor con rol ADMIN siempre es un ADMIN activo más: el último solo se pierde por concurrencia (ver test concurrente)."""
        # El único otro ADMIN activo es el de la fixture; un segundo admin lo desactiva y luego es el último.
        segundo = crear_usuario_con_roles(session, ["ADMIN"])
        headers = bearer_de_usuario(segundo, ["ADMIN"])
        fixture_admin_id = _admin_id(session)
        assert client.delete(f"{LISTADO}{fixture_admin_id}", headers=headers).status_code == 204

        # `segundo` es ahora el único ADMIN; sacarle el rol a sí mismo ya lo frena la propia cuenta.
        response = client.patch(f"{LISTADO}{segundo.id}", json={"roles_codigos": ["CLIENT"]}, headers=headers)

        assert response.status_code == 409


class TestMatrizDeAccesoDeUsuariosAdmin:
    @pytest.mark.parametrize("roles", [["CLIENT"], ["STOCK"], ["PEDIDOS"], ["CLIENT", "STOCK", "PEDIDOS"]])
    def test_los_demas_roles_reciben_403_en_los_cuatro_endpoints(
        self, client: TestClient, session: Session, roles: list[str]
    ):
        headers = bearer_con_roles(session, roles)
        objetivo = crear_usuario_con_roles(session, ["CLIENT"]).id

        respuestas = [
            client.post(ALTA, json=_alta_datos(), headers=headers),
            client.get(LISTADO, headers=headers),
            client.patch(f"{LISTADO}{objetivo}", json={"celular": "1"}, headers=headers),
            client.delete(f"{LISTADO}{objetivo}", headers=headers),
        ]

        assert [r.status_code for r in respuestas] == [403, 403, 403, 403]

    def test_sin_token_devuelve_401_en_los_cuatro_endpoints(self, client: TestClient):
        respuestas = [
            client.post(ALTA, json=_alta_datos()),
            client.get(LISTADO),
            client.patch(f"{LISTADO}1", json={"celular": "1"}),
            client.delete(f"{LISTADO}1"),
        ]

        assert [r.status_code for r in respuestas] == [401, 401, 401, 401]

    def test_admin_con_otros_roles_lista_con_200(self, client: TestClient, session: Session):
        headers = bearer_con_roles(session, ["CLIENT", "ADMIN"])

        assert client.get(LISTADO, headers=headers).status_code == 200
