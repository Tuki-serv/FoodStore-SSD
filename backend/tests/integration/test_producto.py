import pytest
from fastapi.testclient import TestClient

class TestProductoCRUD:
    """Pruebas de integración del módulo de Productos."""

    def test_crear_producto_admin_returns_201(self, client: TestClient, admin_auth_headers: dict):
        """Un administrador puede crear un producto con categorías asignadas."""
        # 1. Crear categoria
        res_cat = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Categoria Prod Test", "descripcion": "Cat Test", "imagen_url": "http", "imagen_public_id": "abc"},
            headers=admin_auth_headers
        )
        cat_id = res_cat.json()["id"]

        # 2. Crear producto
        payload = {
            "nombre": "Producto Test",
            "precio_base": "1500.00",
            "stock_cantidad": 10,
            "disponible": True,
            "categoria_ids": [cat_id]
        }
        response = client.post(
            "/api/v1/productos/",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Producto Test"
        assert "id" in data

    def test_crear_producto_invalido_returns_422(self, client: TestClient, admin_auth_headers: dict):
        """Intentar crear un producto sin campos obligatorios o con tipos incorrectos devuelve 422."""
        payload = {"precio": -50.0} # Sin nombre, sin desc, precio inválido
        response = client.post(
            "/api/v1/productos/",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 422
        data = response.json()
        assert data["code"] == "VALIDATION_ERROR"

    def test_listar_productos_returns_200(self, client: TestClient):
        """Cualquier usuario puede listar los productos paginados."""
        response = client.get("/api/v1/productos/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_producto_por_id_returns_200(self, client: TestClient, admin_auth_headers: dict):
        """Cualquier usuario puede obtener el detalle de un producto específico."""
        res_cat = client.post("/api/v1/categorias/", json={"nombre": "Cat 2", "imagen_url": "http", "imagen_public_id": "abc"}, headers=admin_auth_headers)
        cat_id = res_cat.json()["id"]

        res = client.post(
            "/api/v1/productos/",
            json={"nombre": "Prod GET", "precio_base": "100.00", "stock_cantidad": 5, "categoria_ids": [cat_id]},
            headers=admin_auth_headers
        )
        prod_id = res.json()["id"]

        response = client.get(f"/api/v1/productos/{prod_id}")
        assert response.status_code == 200
        assert response.json()["nombre"] == "Prod GET"

    def test_actualizar_producto_admin_returns_200(self, client: TestClient, admin_auth_headers: dict):
        """Un administrador puede actualizar los datos de un producto (PATCH/PUT)."""
        res_cat = client.post("/api/v1/categorias/", json={"nombre": "Cat 3", "imagen_url": "http", "imagen_public_id": "abc"}, headers=admin_auth_headers)
        cat_id = res_cat.json()["id"]

        res = client.post(
            "/api/v1/productos/",
            json={"nombre": "Para Actualizar", "precio_base": "100.00", "stock_cantidad": 1, "categoria_ids": [cat_id]},
            headers=admin_auth_headers
        )
        prod_id = res.json()["id"]

        response = client.put(
            f"/api/v1/productos/{prod_id}",
            json={"nombre": "Actualizado", "precio_base": "200.00"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["nombre"] == "Actualizado"
        assert response.json()["precio_base"] == "200.00"

    def test_eliminar_producto_admin_returns_204(self, client: TestClient, admin_auth_headers: dict):
        """Un administrador puede eliminar un producto, lo que resulta en un 404 para subsecuentes consultas."""
        res_cat = client.post("/api/v1/categorias/", json={"nombre": "Cat 4", "imagen_url": "http", "imagen_public_id": "abc"}, headers=admin_auth_headers)
        cat_id = res_cat.json()["id"]

        res = client.post(
            "/api/v1/productos/",
            json={"nombre": "Para Eliminar", "precio_base": "100.00", "stock_cantidad": 1, "categoria_ids": [cat_id]},
            headers=admin_auth_headers
        )
        prod_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/productos/{prod_id}", headers=admin_auth_headers)
        assert del_res.status_code == 204

        get_res = client.get(f"/api/v1/productos/{prod_id}")
        assert get_res.status_code == 404
