"""Unidad de medida del ingrediente (C-17b, spec `ingredient-measure-unit`)."""
import pytest
from fastapi.testclient import TestClient

from app.modules.unidades_medida.models import UnidadMedida

BASE = "/api/v1/ingredientes/"


@pytest.fixture(name="unidad_u")
def unidad_u_fixture(session) -> UnidadMedida:
    unidad = UnidadMedida(nombre="Unidad Test", simbolo="ut", tipo="unidad")
    session.add(unidad)
    session.commit()
    session.refresh(unidad)
    return unidad


def _crear(client: TestClient, headers: dict, nombre: str, unidad_id: int) -> dict:
    response = client.post(BASE, json={"nombre": nombre, "unidad_medida_id": unidad_id}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


class TestLecturasIncluyenUnidad:
    def test_listado_trae_la_unidad_de_cada_ingrediente(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db, unidad_u
    ):
        _crear(client, admin_auth_headers, "Harina", unidad_medida_db.id)
        _crear(client, admin_auth_headers, "Huevo", unidad_u.id)

        items = {i["nombre"]: i for i in client.get(BASE).json()["items"]}

        assert items["Harina"]["unidad_medida_id"] == unidad_medida_db.id
        assert items["Huevo"]["unidad_medida_id"] == unidad_u.id

    def test_detalle_alta_y_edicion_incluyen_la_unidad(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db
    ):
        creado = _crear(client, admin_auth_headers, "Mani", unidad_medida_db.id)
        assert creado["unidad_medida_id"] == unidad_medida_db.id

        detalle = client.get(f"{BASE}{creado['id']}").json()
        assert detalle["unidad_medida_id"] == unidad_medida_db.id

        editado = client.patch(f"{BASE}{creado['id']}", json={"es_alergeno": True}, headers=admin_auth_headers)
        assert editado.status_code == 200
        assert editado.json()["unidad_medida_id"] == unidad_medida_db.id


class TestCambiarUnidad:
    def test_admin_cambia_la_unidad_sin_tocar_otros_campos(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db, unidad_u
    ):
        creado = _crear(client, admin_auth_headers, "Sal", unidad_u.id)

        response = client.patch(
            f"{BASE}{creado['id']}", json={"unidad_medida_id": unidad_medida_db.id}, headers=admin_auth_headers
        )

        assert response.status_code == 200
        cuerpo = response.json()
        assert cuerpo["unidad_medida_id"] == unidad_medida_db.id
        assert cuerpo["nombre"] == "Sal"
        assert cuerpo["es_alergeno"] is False
        assert client.get(f"{BASE}{creado['id']}").json()["unidad_medida_id"] == unidad_medida_db.id

    def test_stock_no_puede_cambiar_la_unidad(
        self, client: TestClient, admin_auth_headers: dict, usuario_con_roles, unidad_medida_db, unidad_u
    ):
        creado = _crear(client, admin_auth_headers, "Aceite", unidad_u.id)
        _, headers_stock = usuario_con_roles(["STOCK"])

        response = client.patch(
            f"{BASE}{creado['id']}", json={"unidad_medida_id": unidad_medida_db.id}, headers=headers_stock
        )

        assert response.status_code == 403
        assert client.get(f"{BASE}{creado['id']}").json()["unidad_medida_id"] == unidad_u.id


class TestUnidadDebeExistir:
    def test_alta_con_unidad_inexistente_es_404_y_no_crea(self, client: TestClient, admin_auth_headers: dict):
        response = client.post(BASE, json={"nombre": "Fantasma", "unidad_medida_id": 999999}, headers=admin_auth_headers)

        assert response.status_code == 404
        assert client.get(BASE).json()["total"] == 0

    def test_edicion_con_unidad_inexistente_es_404_y_conserva_la_unidad(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db
    ):
        creado = _crear(client, admin_auth_headers, "Pimienta", unidad_medida_db.id)

        response = client.patch(f"{BASE}{creado['id']}", json={"unidad_medida_id": 999999}, headers=admin_auth_headers)

        assert response.status_code == 404
        assert client.get(f"{BASE}{creado['id']}").json()["unidad_medida_id"] == unidad_medida_db.id

    def test_edicion_con_unidad_nula_es_422_y_conserva_la_unidad(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db
    ):
        creado = _crear(client, admin_auth_headers, "Oregano", unidad_medida_db.id)

        response = client.patch(f"{BASE}{creado['id']}", json={"unidad_medida_id": None}, headers=admin_auth_headers)

        assert response.status_code == 422
        assert client.get(f"{BASE}{creado['id']}").json()["unidad_medida_id"] == unidad_medida_db.id
