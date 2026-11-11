import pytest
from fastapi.testclient import TestClient

class TestUnidadMedidaCRUD:
    def test_crear_unidad_medida_admin_returns_201(self, client: TestClient, admin_auth_headers: dict):
        response = client.post(
            "/api/v1/unidades-medida/",
            json={"nombre": "Kilogramo", "simbolo": "kg", "tipo": "peso"},
            headers=admin_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Kilogramo"
        assert "id" in data

    def test_crear_unidad_medida_normal_user_returns_403(self, client: TestClient, user_auth_headers: dict):
        response = client.post(
            "/api/v1/unidades-medida/",
            json={"nombre": "Prohibido", "simbolo": "pr", "tipo": "peso"},
            headers=user_auth_headers
        )
        assert response.status_code == 403

    def test_listar_unidades_medida_returns_200(self, client: TestClient):
        response = client.get("/api/v1/unidades-medida/")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_get_unidad_medida_por_id_returns_200(self, client: TestClient, admin_auth_headers: dict):
        res = client.post(
            "/api/v1/unidades-medida/",
            json={"nombre": "Litro", "simbolo": "L", "tipo": "volumen"},
            headers=admin_auth_headers
        )
        um_id = res.json()["id"]

        response = client.get(f"/api/v1/unidades-medida/{um_id}")
        assert response.status_code == 200
        assert response.json()["nombre"] == "Litro"

    def test_actualizar_unidad_medida_admin_returns_200(self, client: TestClient, admin_auth_headers: dict):
        res = client.post(
            "/api/v1/unidades-medida/",
            json={"nombre": "Gramos", "simbolo": "g", "tipo": "peso"},
            headers=admin_auth_headers
        )
        um_id = res.json()["id"]

        response = client.patch(
            f"/api/v1/unidades-medida/{um_id}",
            json={"simbolo": "gr"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["simbolo"] == "gr"

    def test_eliminar_unidad_medida_admin_returns_204(self, client: TestClient, admin_auth_headers: dict):
        res = client.post(
            "/api/v1/unidades-medida/",
            json={"nombre": "Para Eliminar", "simbolo": "pe", "tipo": "otro"},
            headers=admin_auth_headers
        )
        um_id = res.json()["id"]

        del_res = client.delete(f"/api/v1/unidades-medida/{um_id}", headers=admin_auth_headers)
        assert del_res.status_code == 204

        get_res = client.get(f"/api/v1/unidades-medida/{um_id}")
        assert get_res.status_code == 404


class TestUnidadMedidaUnicidadEntreActivas:
    URL = "/api/v1/unidades-medida/"

    def test_nombre_repetido_responde_409_con_field_nombre(self, client: TestClient, admin_auth_headers: dict):
        client.post(self.URL, json={"nombre": "Onza", "simbolo": "oz", "tipo": "peso"}, headers=admin_auth_headers)

        response = client.post(self.URL, json={"nombre": "Onza", "simbolo": "onz", "tipo": "peso"}, headers=admin_auth_headers)

        assert response.status_code == 409
        assert (response.json()["code"], response.json()["field"]) == ("DUPLICATE_VALUE", "nombre")

    def test_simbolo_repetido_responde_409_con_field_simbolo(self, client: TestClient, admin_auth_headers: dict):
        client.post(self.URL, json={"nombre": "Libra", "simbolo": "lb", "tipo": "peso"}, headers=admin_auth_headers)

        response = client.post(self.URL, json={"nombre": "Libra 2", "simbolo": "lb", "tipo": "peso"}, headers=admin_auth_headers)

        assert response.status_code == 409
        assert response.json()["field"] == "simbolo"

    def test_editar_con_su_propio_nombre_responde_200(self, client: TestClient, admin_auth_headers: dict):
        creada = client.post(self.URL, json={"nombre": "Taza", "simbolo": "tz", "tipo": "volumen"}, headers=admin_auth_headers).json()

        response = client.patch(f"{self.URL}{creada['id']}", json={"nombre": "Taza"}, headers=admin_auth_headers)

        assert response.status_code == 200

    def test_editar_reusando_el_simbolo_de_una_unidad_eliminada_responde_200(self, client: TestClient, admin_auth_headers: dict):
        eliminada = client.post(self.URL, json={"nombre": "Cuchara", "simbolo": "cu", "tipo": "volumen"}, headers=admin_auth_headers).json()
        assert client.delete(f"{self.URL}{eliminada['id']}", headers=admin_auth_headers).status_code in (200, 204)
        otra = client.post(self.URL, json={"nombre": "Cucharita", "simbolo": "ct", "tipo": "volumen"}, headers=admin_auth_headers).json()

        response = client.patch(f"{self.URL}{otra['id']}", json={"simbolo": "cu"}, headers=admin_auth_headers)

        assert response.status_code == 200
        assert response.json()["simbolo"] == "cu"
