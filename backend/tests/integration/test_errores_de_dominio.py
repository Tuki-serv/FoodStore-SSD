"""Los services lanzan `AppError`; el borde HTTP lo traduce al cuerpo único `{detail, code, field}` (C-25a, D3)."""
from fastapi.testclient import TestClient

from tests.support.auth_helpers import cookie_de_refresh_borrada, renovar


def test_login_con_credenciales_incorrectas_responde_401_con_challenge_bearer_y_codigo_http_401(client: TestClient) -> None:
    response = client.post("/api/v1/auth/login", data={"username": "nadie@example.com", "password": "mala"})

    assert response.status_code == 401
    assert response.json() == {"detail": "Credenciales incorrectas", "code": "HTTP_401", "field": None}
    assert response.headers["www-authenticate"] == "Bearer"


def test_refresh_rechazado_responde_401_borra_la_cookie_y_usa_el_codigo_http_401(client: TestClient) -> None:
    response = renovar(client, "refresh-que-no-existe")

    assert response.status_code == 401
    assert response.json() == {"detail": "Refresh token inválido o expirado", "code": "HTTP_401", "field": None}
    assert cookie_de_refresh_borrada(response)


def test_categoria_inexistente_responde_404_con_codigo_http_404_y_el_detalle_del_modelo(
    client: TestClient, admin_auth_headers: dict
) -> None:
    response = client.get("/api/v1/categorias/999999", headers=admin_auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Categoria no encontrado/a", "code": "HTTP_404", "field": None}


def test_pedido_con_producto_inexistente_responde_404_con_codigo_http_404(
    client: TestClient, user_auth_headers: dict, direccion_db
) -> None:
    payload = {
        "direccion_id": direccion_db.id,
        "forma_pago_codigo": "EFECTIVO",
        "items": [{"producto_id": 999_999, "cantidad": 1}],
    }

    response = client.post("/api/v1/pedidos/", json=payload, headers=user_auth_headers)

    assert response.status_code == 404
    assert response.json() == {"detail": "Producto no encontrado", "code": "HTTP_404", "field": None}
