import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.seed import seed_catalogos
from app.modules.formas_pago.models import FormaPago
from app.modules.pedidos.models import Pedido

# ===========================================================================
# TESTS: Pedidos
# ===========================================================================


class TestCrearPedido:
    """POST /api/v1/pedidos/"""

    def test_crear_pedido_valido(self, client: TestClient, session: Session, user_auth_headers: dict, producto_db, direccion_db):
        payload = {
            "direccion_id": direccion_db.id,
            "forma_pago_codigo": "EFECTIVO",
            "items": [
                {
                    "producto_id": producto_db.id,
                    "cantidad": 1
                }
            ]
        }
        response = client.post(
            "/api/v1/pedidos/",
            json=payload,
            headers=user_auth_headers
        )
        assert response.status_code == 201
        data = response.json()
        assert data["estado_codigo"] == "PENDIENTE"

    def test_crear_pedido_con_transferencia_del_catalogo_del_seed(
        self, client: TestClient, user_auth_headers: dict, producto_db, direccion_db
    ):
        payload = {
            "direccion_id": direccion_db.id,
            "forma_pago_codigo": "TRANSFERENCIA",
            "items": [{"producto_id": producto_db.id, "cantidad": 1}],
        }
        response = client.post("/api/v1/pedidos/", json=payload, headers=user_auth_headers)
        assert response.status_code == 201
        assert response.json()["forma_pago_codigo"] == "TRANSFERENCIA"

    def test_crear_pedido_con_tarjeta_deshabilitada_por_el_seed_responde_400_y_no_crea_pedido(
        self, client: TestClient, session: Session, user_auth_headers: dict, producto_db, direccion_db
    ):
        session.add(FormaPago(codigo="TARJETA", descripcion="Tarjeta", habilitado=True))
        session.commit()
        seed_catalogos(session)
        pedidos_antes = len(session.exec(select(Pedido)).all())

        payload = {
            "direccion_id": direccion_db.id,
            "forma_pago_codigo": "TARJETA",
            "items": [{"producto_id": producto_db.id, "cantidad": 1}],
        }
        response = client.post("/api/v1/pedidos/", json=payload, headers=user_auth_headers)

        assert response.status_code == 400
        assert response.json()["detail"] == "Forma de pago no está habilitada"
        assert len(session.exec(select(Pedido)).all()) == pedidos_antes

    @pytest.mark.parametrize("payload,error_field", [
        pytest.param({"direccion_id": 1, "items": [
                     {"producto_id": 1, "cantidad": 1}]}, "forma_pago_codigo", id="sin-forma-pago"),
        pytest.param({"direccion_id": 1, "forma_pago_codigo": "EFECTIVO",
                     "items": []}, "items", id="sin-detalles"),
    ])
    def test_crear_pedido_invalido_422(self, client: TestClient, user_auth_headers: dict, payload: dict, error_field: str):
        response = client.post(
            "/api/v1/pedidos/",
            json=payload,
            headers=user_auth_headers
        )
        assert response.status_code == 422


class TestAvanzarEstado:
    """PATCH /api/v1/pedidos/{id}/estado"""

    def test_avanzar_estado_valido_admin(self, client: TestClient, admin_auth_headers: dict, pedido_db):
        payload = {
            "nuevo_estado": "CONFIRMADO",
            "motivo": "Todo OK"
        }
        response = client.patch(
            f"/api/v1/pedidos/{pedido_db.id}/estado",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["estado_codigo"] == "CONFIRMADO"

    def test_avanzar_estado_invalido_desde_entregado(self, client: TestClient, session: Session, admin_auth_headers: dict, pedido_db):
        pedido_db.estado_codigo = "ENTREGADO"
        session.add(pedido_db)
        session.commit()

        payload = {
            "nuevo_estado": "EN_PREP",
            "motivo": "Reversa"
        }
        response = client.patch(
            f"/api/v1/pedidos/{pedido_db.id}/estado",
            json=payload,
            headers=admin_auth_headers
        )
        assert response.status_code == 409


class TestMisPedidos:
    """GET /api/v1/pedidos (el cliente ve solo los propios)"""

    def test_listar_mis_pedidos(self, client: TestClient, user_auth_headers: dict, pedido_db):
        """Un usuario puede ver sus propios pedidos."""
        response = client.get(
            "/api/v1/pedidos",
            headers=user_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert [p["id"] for p in data["items"]] == [pedido_db.id]
        assert data["total"] == 1

class TestHistorialEstados:
    """GET /api/v1/pedidos/{id}/historial"""
    
    def test_historial_estados(self, client: TestClient, admin_auth_headers: dict, pedido_db):
        """Podemos obtener el historial de estados de un pedido (requiere ADMIN)."""
        response = client.get(
            f"/api/v1/pedidos/{pedido_db.id}/historial",
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

class TestCancelarPedido:
    """DELETE /api/v1/pedidos/{id}"""

    def test_cancelar_pedido_propio(self, client: TestClient, user_auth_headers: dict, pedido_db):
        payload = {"motivo": "Ya no lo quiero"}
        response = client.request(
            "DELETE",
            f"/api/v1/pedidos/{pedido_db.id}",
            json=payload,
            headers=user_auth_headers
        )
        assert response.status_code == 200
        assert response.json()["estado_codigo"] == "CANCELADO"
        
    def test_cancelar_pedido_terminal_returns_409(self, client: TestClient, session: Session, user_auth_headers: dict, pedido_db):
        """Si un pedido ya está en un estado terminal (ej. ENTREGADO), no se puede cancelar por el usuario."""
        pedido_db.estado_codigo = "ENTREGADO"
        session.add(pedido_db)
        session.commit()
        
        payload = {"motivo": "Intento de fraude"}
        response = client.request(
            "DELETE",
            f"/api/v1/pedidos/{pedido_db.id}",
            json=payload,
            headers=user_auth_headers
        )
        assert response.status_code == 409

class TestRBACPedidos:
    """Permisos por rol en Pedidos"""

    def test_normal_user_cannot_avanzar_estado(self, client: TestClient, user_auth_headers: dict, pedido_db):
        """Un usuario normal NO puede utilizar el endpoint administrativo de avanzar estado."""
        payload = {
            "nuevo_estado": "CONFIRMADO",
            "motivo": "Hacker attempt"
        }
        response = client.patch(
            f"/api/v1/pedidos/{pedido_db.id}/estado",
            json=payload,
            headers=user_auth_headers
        )
        assert response.status_code == 403
