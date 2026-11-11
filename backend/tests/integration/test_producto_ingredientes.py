"""Ingredientes de un producto (C-11, spec `product-ingredients`): lectura pública y quita por ADMIN."""
import pytest
from fastapi.testclient import TestClient

from app.modules.productos.models import Producto


@pytest.fixture(name="producto_con_ingredientes")
def producto_con_ingredientes_fixture(client: TestClient, admin_auth_headers: dict, unidad_medida_db) -> dict:
    """Producto disponible con «Tomate» y «Queso» (alérgeno); devuelve `{producto_id, tomate_id, queso_id}`."""
    categoria = client.post("/api/v1/categorias/", json={"nombre": "Cat Ing", "imagen_url": "http://img.com"}, headers=admin_auth_headers).json()
    tomate = client.post(
        "/api/v1/ingredientes/", json={"nombre": "Tomate", "unidad_medida_id": unidad_medida_db.id}, headers=admin_auth_headers
    ).json()
    queso = client.post(
        "/api/v1/ingredientes/",
        json={"nombre": "Queso", "es_alergeno": True, "unidad_medida_id": unidad_medida_db.id},
        headers=admin_auth_headers,
    ).json()
    producto = client.post(
        "/api/v1/productos/",
        json={
            "nombre": "Pizza Ing",
            "precio_base": "100.00",
            "stock_cantidad": 5,
            "disponible": True,
            "categoria_ids": [categoria["id"]],
        },
        headers=admin_auth_headers,
    )
    assert producto.status_code == 201, producto.text
    producto_id = producto.json()["id"]
    for ingrediente, cantidad, removible in ((tomate, "50", True), (queso, "30", False)):
        asociado = client.post(
            f"/api/v1/productos/{producto_id}/ingredientes",
            json={"ingrediente_id": ingrediente["id"], "cantidad": cantidad, "unidad_medida_id": unidad_medida_db.id, "es_removible": removible},
            headers=admin_auth_headers,
        )
        assert asociado.status_code == 201, asociado.text
    return {"producto_id": producto_id, "tomate_id": tomate["id"], "queso_id": queso["id"]}


class TestListarIngredientesDeUnProducto:
    def test_anonimo_lista_los_ingredientes_ordenados_por_nombre_con_alergeno(self, client, producto_con_ingredientes):
        response = client.get(f"/api/v1/productos/{producto_con_ingredientes['producto_id']}/ingredientes")

        assert response.status_code == 200
        cuerpo = response.json()
        assert [i["nombre"] for i in cuerpo] == ["Queso", "Tomate"]
        assert [i["es_alergeno"] for i in cuerpo] == [True, False]
        assert cuerpo[1]["es_removible"] is True
        assert {"id", "cantidad", "unidad_medida_id"} <= set(cuerpo[0])

    def test_ingrediente_eliminado_no_aparece(self, client, admin_auth_headers, producto_con_ingredientes):
        assert client.delete(f"/api/v1/ingredientes/{producto_con_ingredientes['queso_id']}", headers=admin_auth_headers).status_code in (200, 204)

        response = client.get(f"/api/v1/productos/{producto_con_ingredientes['producto_id']}/ingredientes")

        assert [i["nombre"] for i in response.json()] == ["Tomate"]

    def test_producto_no_disponible_es_404_para_anonimo_y_200_para_stock(
        self, client, session, usuario_con_roles, producto_con_ingredientes
    ):
        producto_id = producto_con_ingredientes["producto_id"]
        producto = session.get(Producto, producto_id)
        producto.disponible = False
        session.add(producto)
        session.commit()
        _, headers_stock = usuario_con_roles(["STOCK"])

        anonimo = client.get(f"/api/v1/productos/{producto_id}/ingredientes")
        stock = client.get(f"/api/v1/productos/{producto_id}/ingredientes", headers=headers_stock)

        assert anonimo.status_code == 404
        assert stock.status_code == 200
        assert len(stock.json()) == 2

    def test_producto_inexistente_es_404(self, client):
        assert client.get("/api/v1/productos/999999/ingredientes").status_code == 404

    def test_producto_sin_ingredientes_devuelve_lista_vacia(self, client, session):
        producto = Producto(nombre="Sin ingredientes", precio_base="10.00", disponible=True, stock_cantidad=1)
        session.add(producto)
        session.commit()

        response = client.get(f"/api/v1/productos/{producto.id}/ingredientes")

        assert response.status_code == 200
        assert response.json() == []


class TestQuitarIngredienteDeUnProducto:
    def test_admin_quita_la_asociacion_y_el_ingrediente_sigue_existiendo(self, client, admin_auth_headers, producto_con_ingredientes):
        producto_id, tomate_id = producto_con_ingredientes["producto_id"], producto_con_ingredientes["tomate_id"]

        response = client.delete(f"/api/v1/productos/{producto_id}/ingredientes/{tomate_id}", headers=admin_auth_headers)

        assert response.status_code == 204
        restantes = client.get(f"/api/v1/productos/{producto_id}/ingredientes").json()
        assert [i["nombre"] for i in restantes] == ["Queso"]
        assert client.get(f"/api/v1/ingredientes/{tomate_id}").status_code == 200

    def test_asociacion_inexistente_es_404(self, client, admin_auth_headers, producto_con_ingredientes):
        producto_id, tomate_id = producto_con_ingredientes["producto_id"], producto_con_ingredientes["tomate_id"]
        assert client.delete(f"/api/v1/productos/{producto_id}/ingredientes/{tomate_id}", headers=admin_auth_headers).status_code == 204

        segunda = client.delete(f"/api/v1/productos/{producto_id}/ingredientes/{tomate_id}", headers=admin_auth_headers)

        assert segunda.status_code == 404

    def test_producto_inexistente_es_404(self, client, admin_auth_headers):
        assert client.delete("/api/v1/productos/999999/ingredientes/1", headers=admin_auth_headers).status_code == 404

    def test_stock_recibe_403_y_la_asociacion_sigue(self, client, usuario_con_roles, producto_con_ingredientes):
        _, headers_stock = usuario_con_roles(["STOCK"])
        producto_id, tomate_id = producto_con_ingredientes["producto_id"], producto_con_ingredientes["tomate_id"]

        response = client.delete(f"/api/v1/productos/{producto_id}/ingredientes/{tomate_id}", headers=headers_stock)

        assert response.status_code == 403
        assert len(client.get(f"/api/v1/productos/{producto_id}/ingredientes").json()) == 2
