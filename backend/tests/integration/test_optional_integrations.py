"""La app y la suite funcionan sin MercadoPago ni Cloudinary; cada integración falla con 503 solo al usarse.

El SDK de MercadoPago y el de Cloudinary están mockeados: ningún test llama a una API real.
"""
import io
from unittest.mock import MagicMock

import cloudinary
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.modules.productos.models import Producto

MP_SETTINGS = ("MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_NOTIFICATION_URL", "BACKEND_PUBLIC_URL", "FRONTEND_URL")
CLOUDINARY_SETTINGS = ("CLOUDINARY_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")


@pytest.fixture(autouse=True)
def sin_integraciones(monkeypatch: pytest.MonkeyPatch) -> None:
    """Estado base de estos tests: ninguna integración opcional configurada."""
    for name in (*MP_SETTINGS, *CLOUDINARY_SETTINGS):
        monkeypatch.setattr(settings, name, None)


@pytest.fixture
def cloudinary_sdk(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """Uploader de Cloudinary mockeado: permite afirmar que no se lo llama."""
    uploader = MagicMock(name="cloudinary.uploader")
    monkeypatch.setattr(cloudinary, "uploader", uploader)
    monkeypatch.setattr(cloudinary, "config", MagicMock(name="cloudinary.config"))
    return uploader


@pytest.fixture
def mp_sdk(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    """`mercadopago.SDK` mockeado: devuelve el mock de la instancia."""
    sdk_class = MagicMock(name="mercadopago.SDK")
    sdk_class.return_value.preference.return_value.create.return_value = {
        "status": 201,
        "response": {"id": "pref-123", "init_point": "https://mp.example/init"},
    }
    monkeypatch.setattr("app.modules.pagos.service.mercadopago.SDK", sdk_class)
    return sdk_class


# ── Arranque y Cloudinary ───────────────────────────────────────────────────

def test_listado_de_productos_responde_200_sin_integraciones_configuradas(client: TestClient) -> None:
    assert client.get("/api/v1/productos/").status_code == 200


def test_soft_delete_de_producto_con_imagenes_responde_204_sin_cloudinary(
    client: TestClient, session: Session, admin_auth_headers: dict, cloudinary_sdk: MagicMock
) -> None:
    producto = Producto(
        nombre="Con imagen",
        precio_base="100.00",
        disponible=True,
        stock_cantidad=1,
        imagenes_url=["https://res.example/a.png"],
        imagenes_public_id=["foodstore/productos/a"],
    )
    session.add(producto)
    session.commit()
    producto_id = producto.id

    response = client.delete(f"/api/v1/productos/{producto_id}", headers=admin_auth_headers)

    assert response.status_code == 204
    session.expire_all()
    assert session.get(Producto, producto_id).deleted_at is not None
    cloudinary_sdk.destroy.assert_not_called()


def test_subir_imagen_sin_cloudinary_responde_503_con_formato_uniforme(
    client: TestClient, admin_auth_headers: dict, cloudinary_sdk: MagicMock
) -> None:
    response = client.post(
        "/api/v1/uploads/imagen",
        files={"archivo": ("a.png", io.BytesIO(b"\x89PNG-bytes"), "image/png")},
        data={"tipo": "categoria"},
        headers=admin_auth_headers,
    )

    assert response.status_code == 503
    assert response.json()["code"] == "HTTP_503"
    cloudinary_sdk.upload.assert_not_called()


# ── MercadoPago ─────────────────────────────────────────────────────────────

def test_crear_pago_sin_access_token_responde_503_nombrando_la_variable(
    client: TestClient, pedido_db, mp_sdk: MagicMock
) -> None:
    response = client.post("/api/v1/pagos/crear", json={"pedido_id": pedido_db.id})

    body = response.json()
    assert response.status_code == 503
    assert body["code"] == "HTTP_503"
    assert "MercadoPago no configurado" in body["detail"]
    assert "MP_ACCESS_TOKEN" in body["detail"]
    mp_sdk.assert_not_called()


def test_crear_pago_con_token_pero_sin_notification_url_responde_503_nombrando_la_faltante(
    client: TestClient, pedido_db, mp_sdk: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "mp-token-falso")
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://b.example")

    response = client.post("/api/v1/pagos/crear", json={"pedido_id": pedido_db.id})

    assert response.status_code == 503
    assert "MP_NOTIFICATION_URL" in response.json()["detail"]
    assert "MP_ACCESS_TOKEN" not in response.json()["detail"]
    mp_sdk.assert_not_called()


def test_crear_pago_con_token_pero_sin_backend_public_url_responde_503_nombrando_la_faltante(
    client: TestClient, pedido_db, mp_sdk: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "mp-token-falso")
    monkeypatch.setattr(settings, "MP_NOTIFICATION_URL", "https://a.example/api/v1/pagos/webhook")

    response = client.post("/api/v1/pagos/crear", json={"pedido_id": pedido_db.id})

    assert response.status_code == 503
    assert "BACKEND_PUBLIC_URL" in response.json()["detail"]


def test_crear_pago_con_todo_configurado_arma_notification_url_y_back_urls_con_los_valores_de_las_variables(
    client: TestClient, pedido_db, mp_sdk: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", "mp-token-falso")
    monkeypatch.setattr(settings, "MP_PUBLIC_KEY", "mp-public-falsa")
    monkeypatch.setattr(settings, "MP_NOTIFICATION_URL", "https://a.example/api/v1/pagos/webhook")
    monkeypatch.setattr(settings, "BACKEND_PUBLIC_URL", "https://b.example")

    response = client.post("/api/v1/pagos/crear", json={"pedido_id": pedido_db.id})

    assert response.status_code == 201
    mp_sdk.assert_called_once_with("mp-token-falso")
    preferencia = mp_sdk.return_value.preference.return_value.create.call_args.args[0]
    assert preferencia["notification_url"] == "https://a.example/api/v1/pagos/webhook"
    assert preferencia["back_urls"] == {
        "success": f"https://b.example/api/v1/pagos/redirect/{pedido_db.id}/success",
        "failure": f"https://b.example/api/v1/pagos/redirect/{pedido_db.id}/failure",
        "pending": f"https://b.example/api/v1/pagos/redirect/{pedido_db.id}/pending",
    }


def test_redirect_de_pago_sin_frontend_url_responde_503(plain_client: TestClient) -> None:
    response = plain_client.get("/api/v1/pagos/redirect/1/success", follow_redirects=False)

    assert response.status_code == 503
    assert response.json()["code"] == "HTTP_503"
    assert "FRONTEND_URL" in response.json()["detail"]


def test_redirect_de_pago_con_frontend_url_redirige_con_los_query_params(
    plain_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "FRONTEND_URL", "https://tienda.example")

    response = plain_client.get("/api/v1/pagos/redirect/7/failure?payment_id=55", follow_redirects=False)

    assert response.status_code in (302, 307)
    assert response.headers["location"] == "https://tienda.example/payment/feedback/7?status=failure&payment_id=55"
