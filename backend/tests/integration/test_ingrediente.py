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


class TestIngredienteUnicidadEntreActivos:
    def test_nombre_repetido_entre_activos_responde_409_y_uno_eliminado_se_reutiliza(
        self, client: TestClient, admin_auth_headers: dict, unidad_medida_db
    ):
        cuerpo = {"nombre": "Tomate", "unidad_medida_id": unidad_medida_db.id}
        creado = client.post("/api/v1/ingredientes/", json=cuerpo, headers=admin_auth_headers)
        assert creado.status_code == 201

        duplicado = client.post("/api/v1/ingredientes/", json=cuerpo, headers=admin_auth_headers)
        assert duplicado.status_code == 409
        assert (duplicado.json()["code"], duplicado.json()["field"]) == ("DUPLICATE_VALUE", "nombre")

        assert client.delete(f"/api/v1/ingredientes/{creado.json()['id']}", headers=admin_auth_headers).status_code in (200, 204)
        assert client.post("/api/v1/ingredientes/", json=cuerpo, headers=admin_auth_headers).status_code == 201

    def test_editar_enviando_el_mismo_nombre_responde_200(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        creado = client.post(
            "/api/v1/ingredientes/", json={"nombre": "Cebolla", "unidad_medida_id": unidad_medida_db.id}, headers=admin_auth_headers
        ).json()

        response = client.patch(f"/api/v1/ingredientes/{creado['id']}", json={"nombre": "Cebolla"}, headers=admin_auth_headers)

        assert response.status_code == 200

    def test_editar_con_el_nombre_de_otro_activo_responde_409(self, client: TestClient, admin_auth_headers: dict, unidad_medida_db):
        client.post("/api/v1/ingredientes/", json={"nombre": "Ajo", "unidad_medida_id": unidad_medida_db.id}, headers=admin_auth_headers)
        otro = client.post(
            "/api/v1/ingredientes/", json={"nombre": "Perejil", "unidad_medida_id": unidad_medida_db.id}, headers=admin_auth_headers
        ).json()

        response = client.patch(f"/api/v1/ingredientes/{otro['id']}", json={"nombre": "Ajo"}, headers=admin_auth_headers)

        assert response.status_code == 409
