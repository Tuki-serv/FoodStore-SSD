"""Arranque de la app: factory, OpenAPI, montaje bajo `/api/v1`, errores uniformes y CORS."""
from fastapi.testclient import TestClient

from app.main import create_app


def test_create_app_devuelve_una_instancia_nueva_por_llamada() -> None:
    assert create_app() is not create_app()


def test_openapi_json_expone_el_titulo_foodstoreapi(plain_client: TestClient) -> None:
    response = plain_client.get("/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "FoodStoreAPI"


def test_listado_de_productos_bajo_api_v1_devuelve_forma_paginada(client: TestClient) -> None:
    response = client.get("/api/v1/productos/")

    assert response.status_code == 200
    body = response.json()
    assert {"items", "total", "page", "size", "pages"} <= set(body)
    assert isinstance(body["items"], list)


def test_ruta_inexistente_devuelve_404_con_formato_uniforme(plain_client: TestClient) -> None:
    response = plain_client.get("/api/v1/no-existe")

    assert response.status_code == 404
    assert set(response.json()) >= {"detail", "code"}
    assert response.json()["code"] == "HTTP_404"


def test_register_con_cuerpo_vacio_devuelve_422_validation_error(plain_client: TestClient) -> None:
    response = plain_client.post("/api/v1/auth/register", json={})

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_cors_preflight_con_origen_permitido_lo_refleja(plain_client: TestClient) -> None:
    response = plain_client.options(
        "/api/v1/productos/",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_preflight_con_origen_no_permitido_no_lo_autoriza(plain_client: TestClient) -> None:
    response = plain_client.options(
        "/api/v1/productos/",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"},
    )

    assert "access-control-allow-origin" not in response.headers
