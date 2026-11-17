"""Contrato de rutas congelado (C-25a, D8): mover o renombrar módulos no cambia método ni path de ninguna ruta.

El conjunto se tomó del código previo a la reorganización y se pegó literal. Incluye HTTP y WebSocket, sin los
`HEAD`/`OPTIONS` implícitos.
"""
from app.main import create_app

RUTAS_ESPERADAS: set[tuple[str, str]] = {
    ("GET", "/api/v1/admin/usuarios/"),
    ("POST", "/api/v1/admin/usuarios/createUser"),
    ("DELETE", "/api/v1/admin/usuarios/{user_id}"),
    ("PATCH", "/api/v1/admin/usuarios/{user_id}"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/logout"),
    ("POST", "/api/v1/auth/logout-all"),
    ("GET", "/api/v1/auth/me"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/register"),
    ("GET", "/api/v1/categorias/"),
    ("POST", "/api/v1/categorias/"),
    ("GET", "/api/v1/categorias/arbol"),
    ("DELETE", "/api/v1/categorias/{categoria_id}"),
    ("GET", "/api/v1/categorias/{categoria_id}"),
    ("PATCH", "/api/v1/categorias/{categoria_id}"),
    ("GET", "/api/v1/direcciones/"),
    ("POST", "/api/v1/direcciones/"),
    ("DELETE", "/api/v1/direcciones/{direccion_id}"),
    ("GET", "/api/v1/direcciones/{direccion_id}"),
    ("PATCH", "/api/v1/direcciones/{direccion_id}"),
    ("PATCH", "/api/v1/direcciones/{direccion_id}/principal"),
    ("GET", "/api/v1/estadisticas/ingresos"),
    ("GET", "/api/v1/estadisticas/pedidos-por-estado"),
    ("GET", "/api/v1/estadisticas/productos-top"),
    ("GET", "/api/v1/estadisticas/resumen"),
    ("GET", "/api/v1/estadisticas/ventas"),
    ("GET", "/api/v1/ingredientes/"),
    ("POST", "/api/v1/ingredientes/"),
    ("DELETE", "/api/v1/ingredientes/{ingrediente_id}"),
    ("GET", "/api/v1/ingredientes/{ingrediente_id}"),
    ("PATCH", "/api/v1/ingredientes/{ingrediente_id}"),
    ("POST", "/api/v1/pagos/crear"),
    ("POST", "/api/v1/pagos/webhook"),
    ("GET", "/api/v1/pagos/{pedido_id}"),
    ("GET", "/api/v1/pedidos/"),
    ("POST", "/api/v1/pedidos/"),
    ("GET", "/api/v1/pedidos/cocina/pedidos"),
    ("DELETE", "/api/v1/pedidos/{pedido_id}"),
    ("GET", "/api/v1/pedidos/{pedido_id}"),
    ("PATCH", "/api/v1/pedidos/{pedido_id}/estado"),
    ("GET", "/api/v1/pedidos/{pedido_id}/historial"),
    ("GET", "/api/v1/productos/"),
    ("POST", "/api/v1/productos/"),
    ("DELETE", "/api/v1/productos/{producto_id}"),
    ("GET", "/api/v1/productos/{producto_id}"),
    ("PUT", "/api/v1/productos/{producto_id}"),
    ("PATCH", "/api/v1/productos/{producto_id}/disponibilidad"),
    ("PATCH", "/api/v1/productos/{producto_id}/imagenes"),
    ("GET", "/api/v1/productos/{producto_id}/ingredientes"),
    ("POST", "/api/v1/productos/{producto_id}/ingredientes"),
    ("DELETE", "/api/v1/productos/{producto_id}/ingredientes/{ingrediente_id}"),
    ("PATCH", "/api/v1/productos/{producto_id}/stock"),
    ("GET", "/api/v1/unidades-medida/"),
    ("POST", "/api/v1/unidades-medida/"),
    ("DELETE", "/api/v1/unidades-medida/{unidad_id}"),
    ("GET", "/api/v1/unidades-medida/{unidad_id}"),
    ("PATCH", "/api/v1/unidades-medida/{unidad_id}"),
    ("POST", "/api/v1/uploads/imagen"),
    ("DELETE", "/api/v1/uploads/imagen/{public_id:path}"),
    ("GET", "/api/v1/usuarios/me"),
    ("PATCH", "/api/v1/usuarios/me"),
    ("GET", "/docs"),
    ("GET", "/docs/oauth2-redirect"),
    ("GET", "/health"),
    ("GET", "/openapi.json"),
    ("GET", "/redoc"),
    ("WEBSOCKET", "/api/v1/pedidos/cocina/ws"),
    ("WEBSOCKET", "/api/v1/pedidos/{pedido_id}/ws"),
}


def _rutas_de_la_app() -> set[tuple[str, str]]:
    """Pares (método, path) de `create_app()`; las rutas WebSocket figuran con el método `WEBSOCKET`."""
    rutas: set[tuple[str, str]] = set()
    for ruta in create_app().routes:
        contextos = ruta.effective_route_contexts() if type(ruta).__name__ == "_IncludedRouter" else [ruta]
        for contexto in contextos:
            metodos = getattr(contexto, "methods", None)
            if metodos:
                rutas.update((m, contexto.path) for m in metodos if m not in ("HEAD", "OPTIONS"))
            else:  # WebSocket: el path incluye el prefijo del include
                prefijo = getattr(getattr(ruta, "include_context", None), "prefix", "")
                original = getattr(contexto, "original_route", contexto)
                rutas.add(("WEBSOCKET", prefijo + original.path))
    return rutas


def test_las_rutas_de_la_app_son_exactamente_las_del_contrato() -> None:
    rutas = _rutas_de_la_app()

    assert rutas - RUTAS_ESPERADAS == set(), "rutas nuevas no previstas"
    assert RUTAS_ESPERADAS - rutas == set(), "rutas del contrato que desaparecieron"


def test_el_contrato_incluye_las_rutas_websocket_de_pedidos() -> None:
    assert {("WEBSOCKET", "/api/v1/pedidos/cocina/ws"), ("WEBSOCKET", "/api/v1/pedidos/{pedido_id}/ws")} <= _rutas_de_la_app()
