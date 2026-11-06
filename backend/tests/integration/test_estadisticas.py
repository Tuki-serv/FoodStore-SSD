import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session
from datetime import date

# ===========================================================================
# TESTS: Estadísticas
# ===========================================================================


class TestEstadisticasResumen:
    """GET /api/v1/estadisticas/resumen"""

    def test_resumen_kpis_excluye_cancelados(self, client: TestClient, session: Session, admin_auth_headers: dict, normal_user: dict, producto_db, direccion_db):
        from app.modules.pedidos.models import Pedido

        p1 = Pedido(usuario_id=normal_user["id"], estado_codigo="PENDIENTE", forma_pago_codigo="EFECTIVO",
                    direccion_id=direccion_db.id, subtotal="1000", total="1000", costo_envio="0", descuento="0")
        p2 = Pedido(usuario_id=normal_user["id"], estado_codigo="CANCELADO", forma_pago_codigo="EFECTIVO",
                    direccion_id=direccion_db.id, subtotal="2000", total="2000", costo_envio="0", descuento="0")

        session.add(p1)
        session.add(p2)
        session.commit()
        
        session.refresh(p1)
        hoy = p1.created_at.date().isoformat()

        response = client.get(f"/api/v1/estadisticas/resumen?desde={hoy}&hasta={hoy}",
                                headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "ventas_hoy" in data
        assert "pedidos_activos" in data


class TestEstadisticasIngresos:
    """GET /api/v1/estadisticas/ingresos"""

    def test_ingresos_solo_cuenta_pagos_aprobados(self, client: TestClient, session: Session, admin_auth_headers: dict, pedido_db):
        from app.modules.pagos.models import Pago
        pago = Pago(pedido_id=pedido_db.id, transaction_amount="1500",
                    metodo_codigo="MERCADO_PAGO", mp_status="approved",
                    idempotency_key="test-idempotency-key")
        session.add(pago)
        session.commit()

        hoy = pedido_db.created_at.date().isoformat()
        response = client.get(
            f"/api/v1/estadisticas/ingresos?desde={hoy}&hasta={hoy}", headers=admin_auth_headers)

        assert response.status_code == 200
        data = response.json()

        assert len(data) > 0
        assert data[0]["forma_pago_codigo"] == "EFECTIVO"
        assert float(data[0]["total"]) == 1500.00


class TestEstadisticasProductosTop:
    """GET /api/v1/estadisticas/productos-top"""

    def test_productos_top_limit(self, client: TestClient, session: Session, admin_auth_headers: dict, pedido_db):
        hoy = pedido_db.created_at.date().isoformat()
        response = client.get(
            f"/api/v1/estadisticas/productos-top?desde={hoy}&hasta={hoy}&limit=5", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


# ===========================================================================
# TESTS: RBAC
# ===========================================================================
class TestRBACEstadisticas:
    """Permisos por rol en Estadísticas"""

    def test_normal_user_cannot_view_estadisticas(self, client: TestClient, user_auth_headers: dict):
        """Un usuario normal NO puede ver el panel de estadísticas (requiere rol ADMIN)."""
        response = client.get(
            "/api/v1/estadisticas/resumen", headers=user_auth_headers)
        assert response.status_code == 403
