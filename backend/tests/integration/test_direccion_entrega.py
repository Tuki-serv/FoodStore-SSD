import pytest
from fastapi.testclient import TestClient

class TestDireccionEntregaCRUD:
    def test_crear_direccion_entrega_returns_201(self, client: TestClient, user_auth_headers: dict):
        response = client.post(
            "/api/v1/direcciones/",
            json={"linea1": "Calle Falsa 123", "ciudad": "Springfield", "provincia": "Springfield"},
            headers=user_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["linea1"] == "Calle Falsa 123"
        assert "id" in data

    def test_listar_direcciones_usuario_returns_200(self, client: TestClient, user_auth_headers: dict):
        # Crear una primero
        client.post(
            "/api/v1/direcciones/",
            json={"linea1": "Evergreen 742", "ciudad": "Springfield", "provincia": "Springfield"},
            headers=user_auth_headers
        )
        
        response = client.get("/api/v1/direcciones/", headers=user_auth_headers)
        assert response.status_code == 200
        data = response.json()
        if isinstance(data, list):
            items = data
        else:
            items = data.get("data", data.get("items", []))
        assert isinstance(items, list)
        assert len(items) > 0

    def test_get_direccion_por_id_returns_200(self, client: TestClient, user_auth_headers: dict):
        res = client.post(
            "/api/v1/direcciones/",
            json={"linea1": "Av Siempre Viva 742", "ciudad": "Springfield", "provincia": "Springfield"},
            headers=user_auth_headers
        )
        dir_id = res.json()["id"]

        response = client.get(f"/api/v1/direcciones/{dir_id}", headers=user_auth_headers)
        assert response.status_code == 200
        assert response.json()["linea1"] == "Av Siempre Viva 742"

    def test_actualizar_direccion_returns_200(self, client: TestClient, user_auth_headers: dict):
        res = client.post(
            "/api/v1/direcciones/",
            json={"linea1": "Calle 1", "ciudad": "Mendoza", "provincia": "Mendoza"},
            headers=user_auth_headers
        )
        dir_id = res.json()["id"]

        response = client.patch(
            f"/api/v1/direcciones/{dir_id}",
            json={"linea1": "Calle 100"},
            headers=user_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["linea1"] == "Calle 100"

    def test_eliminar_direccion_returns_204(self, client: TestClient, user_auth_headers: dict):
        res = client.post(
            "/api/v1/direcciones/",
            json={"linea1": "Para Eliminar", "ciudad": "X", "provincia": "X"},
            headers=user_auth_headers
        )
        dir_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/direcciones/{dir_id}", headers=user_auth_headers)
        assert del_res.status_code == 204

        get_res = client.get(f"/api/v1/direcciones/{dir_id}", headers=user_auth_headers)
        assert get_res.status_code == 404
