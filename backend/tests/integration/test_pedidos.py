import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db.seed import seed_catalogos
from app.modules.pagos.models import FormaPago
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


class TestSuscripcionTiempoReal:
    """`PedidoService.puede_suscribirse` y `rol_para_cocina`: la verificación de los WebSockets vive en el service (C-25a, D5)."""

    def test_puede_suscribirse_el_dueno_del_pedido(self, session: Session, pedido_db: Pedido, normal_user: dict):
        from app.modules.pedidos.service import construir_pedido_service

        assert construir_pedido_service(session).puede_suscribirse(pedido_db.id, normal_user["id"]) is True

    def test_no_puede_suscribirse_otro_usuario(self, session: Session, pedido_db: Pedido, usuario_con_roles):
        from app.modules.pedidos.service import construir_pedido_service

        otro_id, _ = usuario_con_roles(["CLIENT"])

        assert construir_pedido_service(session).puede_suscribirse(pedido_db.id, otro_id) is False

    def test_no_puede_suscribirse_a_un_pedido_inexistente(self, session: Session, normal_user: dict):
        from app.modules.pedidos.service import construir_pedido_service

        assert construir_pedido_service(session).puede_suscribirse(999_999_999, normal_user["id"]) is False

    def test_no_puede_suscribirse_a_un_pedido_eliminado(self, session: Session, pedido_db: Pedido, normal_user: dict):
        from datetime import datetime, timezone

        from app.modules.pedidos.service import construir_pedido_service

        pedido_db.deleted_at = datetime.now(timezone.utc)
        session.add(pedido_db)
        session.commit()

        assert construir_pedido_service(session).puede_suscribirse(pedido_db.id, normal_user["id"]) is False

    @pytest.mark.parametrize("roles, esperado", [(["ADMIN"], "ADMIN"), (["PEDIDOS"], "PEDIDOS"), (["COCINA"], "COCINA")])
    def test_rol_para_cocina_devuelve_el_primer_rol_del_usuario_de_gestion(
        self, session: Session, usuario_con_roles, roles: list[str], esperado: str
    ):
        from app.modules.pedidos.service import construir_pedido_service

        usuario_id, _ = usuario_con_roles(roles)

        assert construir_pedido_service(session).rol_para_cocina(usuario_id) == esperado

    def test_rol_para_cocina_con_roles_de_cliente_y_de_gestion_devuelve_uno_de_los_roles_del_usuario(
        self, session: Session, usuario_con_roles
    ):
        from app.modules.pedidos.service import construir_pedido_service

        usuario_id, _ = usuario_con_roles(["CLIENT", "PEDIDOS"])

        assert construir_pedido_service(session).rol_para_cocina(usuario_id) in {"CLIENT", "PEDIDOS"}

    def test_rol_para_cocina_es_none_para_un_cliente_y_para_un_usuario_inexistente(
        self, session: Session, usuario_con_roles
    ):
        from app.modules.pedidos.service import construir_pedido_service

        cliente_id, _ = usuario_con_roles(["CLIENT"])
        servicio = construir_pedido_service(session)

        assert (servicio.rol_para_cocina(cliente_id), servicio.rol_para_cocina(999_999_999)) == (None, None)
