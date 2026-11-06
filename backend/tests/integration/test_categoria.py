import pytest
from fastapi.testclient import TestClient

class TestCategoriaCRUD:
    def test_crear_categoria_admin_returns_201(self, client: TestClient, admin_auth_headers: dict):
        response = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Bebidas Test", "descripcion": "Cat Test", "imagen_url": "http://img.com"},
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Bebidas Test"
        assert "id" in data

    def test_crear_categoria_normal_user_returns_403(self, client: TestClient, user_auth_headers: dict):
        response = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Prohibido", "descripcion": "Normal user", "imagen_url": "http://img.com"},
            headers=user_auth_headers
        )
        assert response.status_code == 403

    def test_listar_categorias_returns_200(self, client: TestClient):
        response = client.get("/api/v1/categorias/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_categoria_por_id_returns_200(self, client: TestClient, admin_auth_headers: dict):
        # Crear una primero
        res = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Postres Test", "descripcion": "Para test_get", "imagen_url": "http://img.com"},
            headers=admin_auth_headers
        )
        cat_id = res.json()["id"]

        # Obtenerla
        response = client.get(f"/api/v1/categorias/{cat_id}")
        assert response.status_code == 200
        assert response.json()["nombre"] == "Postres Test"

    def test_actualizar_categoria_admin_returns_200(self, client: TestClient, admin_auth_headers: dict):
        res = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Para Actualizar", "descripcion": "Desc", "imagen_url": "http://img.com"},
            headers=admin_auth_headers
        )
        cat_id = res.json()["id"]

        response = client.patch(
            f"/api/v1/categorias/{cat_id}",
            json={"nombre": "Actualizada"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["nombre"] == "Actualizada"

    def test_eliminar_categoria_admin_returns_204(self, client: TestClient, admin_auth_headers: dict):
        res = client.post(
            "/api/v1/categorias/",
            json={"nombre": "Para Eliminar", "imagen_url": "http://img.com"},
            headers=admin_auth_headers
        )
        cat_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/categorias/{cat_id}", headers=admin_auth_headers)
        assert del_res.status_code == 204

        get_res = client.get(f"/api/v1/categorias/{cat_id}")
        assert get_res.status_code == 404
