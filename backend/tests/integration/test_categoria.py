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


class TestCategoriaUnicidadEntreActivas:
    """RN-CA-02: el nombre es único solo entre categorías activas; el duplicado responde 409 `DUPLICATE_VALUE`."""

    @staticmethod
    def _crear(client: TestClient, headers: dict, nombre: str):
        return client.post("/api/v1/categorias/", json={"nombre": nombre, "imagen_url": "http://img.com"}, headers=headers)

    def test_nombre_de_una_categoria_eliminada_se_puede_reutilizar(self, client: TestClient, admin_auth_headers: dict):
        primera = self._crear(client, admin_auth_headers, "Bebidas")
        assert client.delete(f"/api/v1/categorias/{primera.json()['id']}", headers=admin_auth_headers).status_code == 204

        response = self._crear(client, admin_auth_headers, "Bebidas")

        assert response.status_code == 201

    def test_nombre_de_una_categoria_activa_responde_409_con_codigo_y_campo(self, client: TestClient, admin_auth_headers: dict):
        self._crear(client, admin_auth_headers, "Postres")

        response = self._crear(client, admin_auth_headers, "Postres")

        assert response.status_code == 409
        assert response.json()["code"] == "DUPLICATE_VALUE"
        assert response.json()["field"] == "nombre"

    def test_editar_con_su_propio_nombre_responde_200_y_con_el_de_otra_activa_409(self, client: TestClient, admin_auth_headers: dict):
        self._crear(client, admin_auth_headers, "Entradas")
        otra = self._crear(client, admin_auth_headers, "Platos").json()

        propio = client.patch(f"/api/v1/categorias/{otra['id']}", json={"nombre": "Platos"}, headers=admin_auth_headers)
        ajeno = client.patch(f"/api/v1/categorias/{otra['id']}", json={"nombre": "Entradas"}, headers=admin_auth_headers)

        assert propio.status_code == 200
        assert ajeno.status_code == 409


class TestCategoriaBajaConValidacion:
    """RN-CA-03: baja solo si no tiene productos activos ni subcategorías activas (409 con código propio)."""

    URL = "/api/v1/categorias/"

    def _crear(self, client, headers, nombre, parent_id=None):
        cuerpo = {"nombre": nombre, "imagen_url": "http://img.com", "imagen_public_id": f"pid-{nombre}"}
        if parent_id is not None:
            cuerpo["parent_id"] = parent_id
        r = client.post(self.URL, json=cuerpo, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def _producto(self, client, headers, nombre, categoria_id):
        r = client.post(
            "/api/v1/productos/",
            json={"nombre": nombre, "precio_base": "10.00", "stock_cantidad": 1, "categoria_ids": [categoria_id]},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]

    @pytest.fixture(name="cloudinary")
    def cloudinary_fixture(self, monkeypatch):
        llamadas: list[str] = []
        monkeypatch.setattr("app.modules.categorias.service.eliminar_imagen", lambda public_id: llamadas.append(public_id) or True)
        return llamadas

    def test_con_un_producto_activo_responde_409_y_no_toca_nada(self, client, admin_auth_headers, cloudinary):
        cat = self._crear(client, admin_auth_headers, "ConProducto")
        self._producto(client, admin_auth_headers, "Prod Cat", cat)

        response = client.delete(f"{self.URL}{cat}", headers=admin_auth_headers)

        assert response.status_code == 409
        assert response.json()["code"] == "CATEGORY_HAS_PRODUCTS"
        assert client.get(f"{self.URL}{cat}").status_code == 200
        assert cloudinary == []

    def test_con_una_hija_activa_responde_409_y_la_hija_conserva_su_padre(self, client, admin_auth_headers, cloudinary):
        padre = self._crear(client, admin_auth_headers, "Padre")
        hija = self._crear(client, admin_auth_headers, "Hija", parent_id=padre)

        response = client.delete(f"{self.URL}{padre}", headers=admin_auth_headers)

        assert response.status_code == 409
        assert response.json()["code"] == "CATEGORY_HAS_CHILDREN"
        assert client.get(f"{self.URL}{hija}").json()["parent_id"] == padre
        assert cloudinary == []

    def test_con_productos_e_hijas_prevalece_category_has_products(self, client, admin_auth_headers, cloudinary):
        padre = self._crear(client, admin_auth_headers, "PadreMixto")
        self._crear(client, admin_auth_headers, "HijaMixta", parent_id=padre)
        self._producto(client, admin_auth_headers, "Prod Mixto", padre)

        response = client.delete(f"{self.URL}{padre}", headers=admin_auth_headers)

        assert response.status_code == 409
        assert response.json()["code"] == "CATEGORY_HAS_PRODUCTS"

    def test_con_solo_un_producto_eliminado_se_da_de_baja(self, client, admin_auth_headers, cloudinary):
        cat = self._crear(client, admin_auth_headers, "ProdEliminado")
        producto = self._producto(client, admin_auth_headers, "Prod Eliminado", cat)
        assert client.delete(f"/api/v1/productos/{producto}", headers=admin_auth_headers).status_code == 204

        assert client.delete(f"{self.URL}{cat}", headers=admin_auth_headers).status_code == 204

    def test_con_solo_una_hija_eliminada_se_da_de_baja_y_la_hija_conserva_su_padre(
        self, client, session, admin_auth_headers, cloudinary
    ):
        from app.modules.categorias.models import Categoria

        padre = self._crear(client, admin_auth_headers, "PadreHijaEliminada")
        hija = self._crear(client, admin_auth_headers, "HijaEliminada", parent_id=padre)
        assert client.delete(f"{self.URL}{hija}", headers=admin_auth_headers).status_code == 204

        assert client.delete(f"{self.URL}{padre}", headers=admin_auth_headers).status_code == 204

        session.expire_all()
        assert session.get(Categoria, hija).parent_id == padre

    def test_hoja_vacia_se_da_de_baja_borra_la_imagen_y_no_aparece_en_el_listado(self, client, admin_auth_headers, cloudinary):
        cat = self._crear(client, admin_auth_headers, "Hoja")

        assert client.delete(f"{self.URL}{cat}", headers=admin_auth_headers).status_code == 204

        assert cloudinary == ["pid-Hoja"]
        assert cat not in [c["id"] for c in client.get(self.URL).json()["items"]]
