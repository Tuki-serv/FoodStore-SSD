import pytest
from fastapi.testclient import TestClient

class TestIngredienteCRUD:
    def test_crear_ingrediente_admin_returns_201(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        response = client.post(
            "/api/v1/ingredientes/",
            json={"nombre": "Carne", "unidad_medida_id": unidad_medida_db.id},
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Carne"
        assert "id" in data

    def test_crear_ingrediente_normal_user_returns_403(self, client: TestClient, user_auth_headers: dict):
        response = client.post(
            "/api/v1/ingredientes/",
            json={"nombre": "Prohibido"},
            headers=user_auth_headers
        )
        assert response.status_code == 403

    def test_listar_ingredientes_returns_200(self, client: TestClient):
        response = client.get("/api/v1/ingredientes/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_ingrediente_por_id_returns_200(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        res = client.post(
            "/api/v1/ingredientes/",
            json={"nombre": "Queso Test", "unidad_medida_id": unidad_medida_db.id},
            headers=admin_auth_headers
        )
        ing_id = res.json()["id"]

        response = client.get(f"/api/v1/ingredientes/{ing_id}")
        assert response.status_code == 200
        assert response.json()["nombre"] == "Queso Test"

    def test_actualizar_ingrediente_admin_returns_200(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        res = client.post(
            "/api/v1/ingredientes/",
            json={"nombre": "Pan", "unidad_medida_id": unidad_medida_db.id},
            headers=admin_auth_headers
        )
        ing_id = res.json()["id"]

        response = client.patch(
            f"/api/v1/ingredientes/{ing_id}",
            json={"nombre": "Pan Frances"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["nombre"] == "Pan Frances"

    def test_eliminar_ingrediente_admin_returns_204(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        res = client.post(
            "/api/v1/ingredientes/",
            json={"nombre": "Para Eliminar", "unidad_medida_id": unidad_medida_db.id},
            headers=admin_auth_headers
        )
        ing_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/ingredientes/{ing_id}", headers=admin_auth_headers)
        assert del_res.status_code == 204

        get_res = client.get(f"/api/v1/ingredientes/{ing_id}")
        assert get_res.status_code == 404
