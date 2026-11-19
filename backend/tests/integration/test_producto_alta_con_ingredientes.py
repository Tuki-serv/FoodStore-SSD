"""Alta y edición de productos con ingredientes, categorías y unidades (C-17b, spec `product-ingredients`)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import func, select

from app.modules.productos.models import Producto

PRODUCTOS = "/api/v1/productos/"


@pytest.fixture(name="catalogo")
def catalogo_fixture(client: TestClient, admin_auth_headers: dict, unidad_medida_db) -> dict:
    """Dos categorías y dos ingredientes (todos medidos en la unidad de test)."""

    def post(url: str, cuerpo: dict) -> dict:
        response = client.post(url, json=cuerpo, headers=admin_auth_headers)
        assert response.status_code == 201, response.text
        return response.json()

    return {
        "unidad": unidad_medida_db.id,
        "cat_a": post("/api/v1/categorias/", {"nombre": "Cat A", "imagen_url": "http://img.com"})["id"],
        "cat_b": post("/api/v1/categorias/", {"nombre": "Cat B", "imagen_url": "http://img.com"})["id"],
        "pan": post("/api/v1/ingredientes/", {"nombre": "Pan", "unidad_medida_id": unidad_medida_db.id})["id"],
        "tomate": post("/api/v1/ingredientes/", {"nombre": "Tomate", "unidad_medida_id": unidad_medida_db.id})["id"],
    }


def _cuerpo(catalogo: dict, nombre: str = "Burger", **extra) -> dict:
    return {
        "nombre": nombre,
        "precio_base": "2500.00",
        "stock_cantidad": 10,
        "categoria_ids": [catalogo["cat_a"]],
        **extra,
    }


def _ing(catalogo: dict, clave: str, cantidad="1", removible=False, unidad=None) -> dict:
    return {
        "ingrediente_id": catalogo[clave],
        "cantidad": cantidad,
        "unidad_medida_id": unidad if unidad is not None else catalogo["unidad"],
        "es_removible": removible,
    }


def _contar_productos(session) -> int:
    session.expire_all()
    return session.exec(select(func.count()).select_from(Producto)).one()


class TestAltaConIngredientes:
    def test_alta_guarda_cantidad_unidad_y_removible_de_cada_ingrediente(self, client, admin_auth_headers, catalogo):
        cuerpo = _cuerpo(catalogo, ingredientes=[_ing(catalogo, "pan", "1"), _ing(catalogo, "tomate", "2", removible=True)])

        response = client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers)

        assert response.status_code == 201, response.text
        por_id = {i["id"]: i for i in response.json()["ingredientes"]}
        assert float(por_id[catalogo["pan"]]["cantidad"]) == 1
        assert por_id[catalogo["pan"]]["es_removible"] is False
        assert float(por_id[catalogo["tomate"]]["cantidad"]) == 2
        assert por_id[catalogo["tomate"]]["es_removible"] is True
        assert por_id[catalogo["tomate"]]["unidad_medida_id"] == catalogo["unidad"]

    def test_alta_sin_ingredientes_sigue_funcionando(self, client, admin_auth_headers, catalogo):
        response = client.post(PRODUCTOS, json=_cuerpo(catalogo), headers=admin_auth_headers)

        assert response.status_code == 201
        assert response.json()["ingredientes"] == []

    def test_unidad_inexistente_es_404_y_no_crea_el_producto(self, client, admin_auth_headers, session, catalogo):
        antes = _contar_productos(session)
        cuerpo = _cuerpo(catalogo, ingredientes=[_ing(catalogo, "pan", unidad=999999)])

        response = client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers)

        assert response.status_code == 404
        assert _contar_productos(session) == antes

    def test_ingrediente_inexistente_es_404_y_no_crea_el_producto(self, client, admin_auth_headers, session, catalogo):
        antes = _contar_productos(session)
        cuerpo = _cuerpo(catalogo, ingredientes=[{**_ing(catalogo, "pan"), "ingrediente_id": 999999}])

        response = client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers)

        assert response.status_code == 404
        assert _contar_productos(session) == antes

    def test_unidad_de_venta_inexistente_en_el_alta_es_404(self, client, admin_auth_headers, session, catalogo):
        antes = _contar_productos(session)

        response = client.post(PRODUCTOS, json=_cuerpo(catalogo, unidad_venta_id=999999), headers=admin_auth_headers)

        assert response.status_code == 404
        assert _contar_productos(session) == antes


class TestEdicionConIngredientes:
    def _crear(self, client, headers, catalogo) -> int:
        cuerpo = _cuerpo(catalogo, ingredientes=[_ing(catalogo, "pan"), _ing(catalogo, "tomate", "2", removible=True)])
        response = client.post(PRODUCTOS, json=cuerpo, headers=headers)
        assert response.status_code == 201, response.text
        return response.json()["id"]

    def test_put_con_ingredientes_reemplaza_la_lista(self, client, admin_auth_headers, catalogo):
        producto_id = self._crear(client, admin_auth_headers, catalogo)

        response = client.put(
            f"{PRODUCTOS}{producto_id}",
            json={"ingredientes": [_ing(catalogo, "tomate", "3", removible=False)]},
            headers=admin_auth_headers,
        )

        assert response.status_code == 200, response.text
        lista = client.get(f"{PRODUCTOS}{producto_id}/ingredientes").json()
        assert [i["nombre"] for i in lista] == ["Tomate"]
        assert float(lista[0]["cantidad"]) == 3
        assert lista[0]["es_removible"] is False

    def test_put_sin_ingredientes_no_los_toca(self, client, admin_auth_headers, catalogo):
        producto_id = self._crear(client, admin_auth_headers, catalogo)

        response = client.put(f"{PRODUCTOS}{producto_id}", json={"precio_base": "2000.00"}, headers=admin_auth_headers)

        assert response.status_code == 200
        lista = client.get(f"{PRODUCTOS}{producto_id}/ingredientes").json()
        assert [i["nombre"] for i in lista] == ["Pan", "Tomate"]

    def test_put_con_unidad_inexistente_es_404_y_conserva_la_lista(self, client, admin_auth_headers, catalogo):
        producto_id = self._crear(client, admin_auth_headers, catalogo)

        response = client.put(
            f"{PRODUCTOS}{producto_id}",
            json={"ingredientes": [_ing(catalogo, "pan", unidad=999999)]},
            headers=admin_auth_headers,
        )

        assert response.status_code == 404
        assert [i["nombre"] for i in client.get(f"{PRODUCTOS}{producto_id}/ingredientes").json()] == ["Pan", "Tomate"]

    def test_put_con_ingrediente_eliminado_es_404(self, client, admin_auth_headers, catalogo):
        producto_id = self._crear(client, admin_auth_headers, catalogo)
        assert client.delete(f"/api/v1/ingredientes/{catalogo['pan']}", headers=admin_auth_headers).status_code == 204

        response = client.put(
            f"{PRODUCTOS}{producto_id}", json={"ingredientes": [_ing(catalogo, "pan")]}, headers=admin_auth_headers
        )

        assert response.status_code == 404

    def test_asociar_ingrediente_sigue_creando_y_actualizando_el_vinculo(self, client, admin_auth_headers, catalogo):
        producto_id = self._crear(client, admin_auth_headers, catalogo)

        response = client.post(
            f"{PRODUCTOS}{producto_id}/ingredientes",
            json=_ing(catalogo, "pan", "9", removible=True),
            headers=admin_auth_headers,
        )

        assert response.status_code == 201, response.text
        pan = next(i for i in client.get(f"{PRODUCTOS}{producto_id}/ingredientes").json() if i["nombre"] == "Pan")
        assert float(pan["cantidad"]) == 9 and pan["es_removible"] is True


class TestValidacionDeListas:
    def test_ingrediente_repetido_es_422_y_no_crea(self, client, admin_auth_headers, session, catalogo):
        antes = _contar_productos(session)
        cuerpo = _cuerpo(catalogo, ingredientes=[_ing(catalogo, "pan"), _ing(catalogo, "pan", "2")])

        response = client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers)

        assert response.status_code == 422
        assert _contar_productos(session) == antes

    def test_ingrediente_repetido_en_edicion_es_422(self, client, admin_auth_headers, catalogo):
        creado = client.post(PRODUCTOS, json=_cuerpo(catalogo), headers=admin_auth_headers).json()

        response = client.put(
            f"{PRODUCTOS}{creado['id']}",
            json={"ingredientes": [_ing(catalogo, "pan"), _ing(catalogo, "pan")]},
            headers=admin_auth_headers,
        )

        assert response.status_code == 422

    def test_categorias_repetidas_en_put_es_422_y_no_cambian(self, client, admin_auth_headers, catalogo):
        creado = client.post(
            PRODUCTOS,
            json=_cuerpo(catalogo, categoria_ids=[catalogo["cat_a"], catalogo["cat_b"]]),
            headers=admin_auth_headers,
        ).json()

        response = client.put(
            f"{PRODUCTOS}{creado['id']}",
            json={"categoria_ids": [catalogo["cat_b"], catalogo["cat_b"]]},
            headers=admin_auth_headers,
        )

        assert response.status_code == 422
        actual = client.get(f"{PRODUCTOS}{creado['id']}", headers=admin_auth_headers).json()["categorias"]
        assert [c["id"] for c in actual] == [catalogo["cat_a"], catalogo["cat_b"]]

    def test_categorias_repetidas_en_el_alta_es_422(self, client, admin_auth_headers, catalogo):
        cuerpo = _cuerpo(catalogo, categoria_ids=[catalogo["cat_a"], catalogo["cat_a"]])

        assert client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers).status_code == 422

    @pytest.mark.parametrize("cantidad", ["0", "-1"])
    def test_cantidad_no_positiva_es_422(self, client, admin_auth_headers, session, catalogo, cantidad):
        antes = _contar_productos(session)
        cuerpo = _cuerpo(catalogo, ingredientes=[_ing(catalogo, "pan", cantidad)])

        response = client.post(PRODUCTOS, json=cuerpo, headers=admin_auth_headers)

        assert response.status_code == 422
        assert _contar_productos(session) == antes
