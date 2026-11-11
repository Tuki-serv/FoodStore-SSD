"""La app y la suite funcionan sin MercadoPago ni Cloudinary; cada integración falla con 503 solo al usarse.

El borde de MercadoPago (`mp_sdk`, `MPFalso`) y el SDK de Cloudinary están mockeados: ningún test llama a una API real.
"""
import io
from unittest.mock import MagicMock

import cloudinary
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.modules.productos.models import Producto
from tests.support.mp_webhook import MPFalso
from tests.support.pagos_factory import pagos_de, pedido_a_pagar, producto

MP_SETTINGS = ("MP_ACCESS_TOKEN", "MP_PUBLIC_KEY", "MP_NOTIFICATION_URL")
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
def pedido_mp(session: Session, normal_user: dict):
    """Pedido `MERCADOPAGO` `PENDIENTE` del cliente `normal_user`, sin pagos."""
    return pedido_a_pagar(session, normal_user["id"], producto(session, "Opcional", 5))


def cuerpo(pedido_id: int) -> dict:
    return {
        "pedido_id": pedido_id,
        "token": "tok-1",
        "payment_method_id": "visa",
        "installments": 1,
        "payer": {"email": "a@test.com"},
    }


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

def test_crear_pago_sin_access_token_responde_503_nombrando_la_variable_y_no_crea_pagos(
    client: TestClient, session: Session, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", None)

    response = client.post("/api/v1/pagos/crear", json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    body = response.json()
    assert response.status_code == 503
    assert body["code"] == "HTTP_503"
    assert body["field"] is None
    assert "MercadoPago no configurado" in body["detail"]
    assert "MP_ACCESS_TOKEN" in body["detail"]
    assert "MP_NOTIFICATION_URL" not in body["detail"]
    assert pagos_de(session, pedido_mp.id) == []
    assert mp_sdk.creaciones == []


def test_crear_pago_con_token_pero_sin_notification_url_responde_503_nombrando_la_faltante(
    client: TestClient, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_NOTIFICATION_URL", None)

    response = client.post("/api/v1/pagos/crear", json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    assert response.status_code == 503
    assert "MP_NOTIFICATION_URL" in response.json()["detail"]
    assert "MP_ACCESS_TOKEN" not in response.json()["detail"]
    assert mp_sdk.creaciones == []


def test_crear_pago_sin_ninguna_variable_de_pagos_nombra_las_dos(
    client: TestClient, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MP_ACCESS_TOKEN", None)
    monkeypatch.setattr(settings, "MP_NOTIFICATION_URL", None)

    response = client.post("/api/v1/pagos/crear", json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    assert response.status_code == 503
    assert "MP_ACCESS_TOKEN" in response.json()["detail"]
    assert "MP_NOTIFICATION_URL" in response.json()["detail"]


def test_crear_pago_ya_no_exige_backend_public_url_y_usa_la_notification_url_configurada(
    client: TestClient, pedido_mp, user_auth_headers: dict, mp_sdk: MPFalso
) -> None:
    mp_sdk.responder_creacion(201, "in_process", "pending_contingency", payment_id=950)

    response = client.post("/api/v1/pagos/crear", json=cuerpo(pedido_mp.id), headers=user_auth_headers)

    assert response.status_code == 201
    assert mp_sdk.tokens == ["TEST-token"]
    (creacion,) = mp_sdk.creaciones
    assert creacion.cuerpo["notification_url"] == "https://a.example/api/v1/pagos/webhook"
    assert "back_urls" not in creacion.cuerpo


@pytest.mark.parametrize("status", ["success", "failure", "pending"])
def test_el_redirect_de_checkout_pro_responde_404_con_o_sin_mercadopago_configurado(
    plain_client: TestClient, status: str
) -> None:
    response = plain_client.get(f"/api/v1/pagos/redirect/1/{status}?payment_id=55", follow_redirects=False)

    assert response.status_code == 404
    assert response.json()["code"] == "HTTP_404"
    assert "location" not in response.headers
