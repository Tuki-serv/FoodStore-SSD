"""WebSocket de pedidos y de cocina (C-25a): cierre 1008 sin credencial o sin permiso, y conexión del dueño.

Caracterizan el comportamiento existente de `modules/pedidos/router.py` con `TestClient.websocket_connect`; el token
viaja en la cookie `access_token`, como hace el navegador.
"""
from uuid import uuid4

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token

BASE = "/api/v1/pedidos"


def _con_cookie(client: TestClient, token: str | None) -> TestClient:
    client.cookies.clear()
    if token is not None:
        client.cookies.set("access_token", token)
    return client


def _access(usuario_id: int, roles: list[str]) -> str:
    return create_access_token(sub=str(usuario_id), roles=roles, sid=str(uuid4()))


def _rechazada_con_1008(client: TestClient, ruta: str) -> None:
    with client.websocket_connect(ruta) as ws:
        with pytest.raises(WebSocketDisconnect) as info:
            ws.receive_text()
    assert info.value.code == 1008


class TestWebSocketDePedido:
    def test_sin_cookie_se_cierra_con_1008(self, client: TestClient, pedido_db) -> None:
        _rechazada_con_1008(_con_cookie(client, None), f"{BASE}/{pedido_db.id}/ws")

    def test_token_invalido_se_cierra_con_1008(self, client: TestClient, pedido_db) -> None:
        _rechazada_con_1008(_con_cookie(client, "no-es-un-jwt"), f"{BASE}/{pedido_db.id}/ws")

    def test_usuario_que_no_es_dueno_se_cierra_con_1008(self, client: TestClient, pedido_db, usuario_con_roles) -> None:
        ajeno_id, _ = usuario_con_roles(["CLIENT"])

        _rechazada_con_1008(_con_cookie(client, _access(ajeno_id, ["CLIENT"])), f"{BASE}/{pedido_db.id}/ws")

    def test_pedido_inexistente_se_cierra_con_1008(self, client: TestClient, normal_user: dict) -> None:
        _rechazada_con_1008(_con_cookie(client, _access(normal_user["id"], ["CLIENT"])), f"{BASE}/999999/ws")

    def test_el_dueno_se_conecta(self, client: TestClient, pedido_db, normal_user: dict) -> None:
        from app.core.websocket import manager

        _con_cookie(client, _access(normal_user["id"], ["CLIENT"]))
        with client.websocket_connect(f"{BASE}/{pedido_db.id}/ws") as ws:
            assert f"role:PEDIDO:{pedido_db.id}" in manager.rooms
            ws.send_text("ping")


class TestWebSocketDeCocina:
    def test_sin_cookie_se_cierra_con_1008(self, client: TestClient) -> None:
        _rechazada_con_1008(_con_cookie(client, None), f"{BASE}/cocina/ws")

    def test_un_cliente_sin_rol_de_gestion_se_cierra_con_1008(self, client: TestClient, usuario_con_roles) -> None:
        cliente_id, _ = usuario_con_roles(["CLIENT"])

        _rechazada_con_1008(_con_cookie(client, _access(cliente_id, ["CLIENT"])), f"{BASE}/cocina/ws")

    def test_un_usuario_de_cocina_se_conecta(self, client: TestClient, usuario_con_roles) -> None:
        from app.core.websocket import manager

        cocina_id, _ = usuario_con_roles(["COCINA"])

        _con_cookie(client, _access(cocina_id, ["COCINA"]))
        with client.websocket_connect(f"{BASE}/cocina/ws") as ws:
            assert "role:COCINA" in manager.rooms
            ws.send_text("ping")
