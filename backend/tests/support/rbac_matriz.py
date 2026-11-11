"""Matriz RBAC ejecutable: una fila por endpoint (relevamiento de `design.md` de C-08, filas 2-63 y la 34 nueva).

Es la ÚNICA tabla de permisos de los tests: el change dueño de una fila provisoria (columna `dueno`) la actualiza en
su propio PR. Los literales de roles se escriben a mano; nunca se derivan de código de producción.
"""
from dataclasses import dataclass

PUBLICO = "PUBLICO"
AUTENTICADO = "AUTENTICADO"
Acceso = str | frozenset[str]

ID_INEXISTENTE = 999999

ADMIN = frozenset({"ADMIN"})
ADMIN_STOCK = frozenset({"ADMIN", "STOCK"})
ADMIN_PEDIDOS = frozenset({"ADMIN", "PEDIDOS"})
ADMIN_PEDIDOS_COCINA = frozenset({"ADMIN", "PEDIDOS", "COCINA"})
CLIENT = frozenset({"CLIENT"})
CLIENT_ADMIN_PEDIDOS = frozenset({"CLIENT", "ADMIN", "PEDIDOS"})


@dataclass(frozen=True)
class Fila:
    metodo: str
    plantilla: str  # ruta tal como la registra FastAPI (con `{param}`)
    acceso: Acceso
    body: dict | None = None  # JSON mínimo (puede ser inválido: la autorización se resuelve antes que el 422)
    dueno: str | None = None  # change dueño si la fila es provisoria
    credencial_propia: bool = False  # PUBLICO que igual responde 401 anónimo (login/refresh sin credenciales)

    @property
    def ruta(self) -> str:
        """Ruta concreta: los parámetros se reemplazan por ids inexistentes para no producir efectos."""
        ruta = self.plantilla.replace("{public_id:path}", "inexistente/x")
        partes = ruta.split("{")
        resultado = partes[0]
        for parte in partes[1:]:
            resultado += str(ID_INEXISTENTE) + parte.split("}", 1)[1]
        return resultado


P = "/api/v1"

FILAS: tuple[Fila, ...] = (
    # Auth (filas 2-7)
    Fila("POST", f"{P}/auth/register", PUBLICO, {}),
    Fila("POST", f"{P}/auth/login", PUBLICO, {}, dueno="C-03 (rate limit)", credencial_propia=True),
    Fila("POST", f"{P}/auth/refresh", PUBLICO, credencial_propia=True),
    Fila("POST", f"{P}/auth/logout", AUTENTICADO),
    Fila("POST", f"{P}/auth/logout-all", AUTENTICADO),
    Fila("GET", f"{P}/auth/me", AUTENTICADO),
    # Perfil propio (8-9)
    Fila("GET", f"{P}/usuarios/me", AUTENTICADO, dueno="C-14/C-25a (retiro)"),
    Fila("PATCH", f"{P}/usuarios/me", AUTENTICADO, {}),
    # Admin de usuarios (10-13)
    Fila("POST", f"{P}/admin/usuarios/createUser", ADMIN, {}),
    Fila("GET", f"{P}/admin/usuarios/", ADMIN),
    Fila("PATCH", f"{P}/admin/usuarios/{{user_id}}", ADMIN, {}),
    Fila("DELETE", f"{P}/admin/usuarios/{{user_id}}", ADMIN),
    # Direcciones (14-19): OQ-4, cualquier autenticado sobre sus propias direcciones
    Fila("POST", f"{P}/direcciones/", AUTENTICADO, {}, dueno="OQ-4"),
    Fila("GET", f"{P}/direcciones/", AUTENTICADO, dueno="OQ-4"),
    Fila("GET", f"{P}/direcciones/{{direccion_id}}", AUTENTICADO, dueno="OQ-4"),
    Fila("PATCH", f"{P}/direcciones/{{direccion_id}}", AUTENTICADO, {}, dueno="OQ-4"),
    Fila("PATCH", f"{P}/direcciones/{{direccion_id}}/principal", AUTENTICADO, dueno="OQ-4"),
    Fila("DELETE", f"{P}/direcciones/{{direccion_id}}", AUTENTICADO, dueno="OQ-4"),
    # Categorías (20-25)
    Fila("POST", f"{P}/categorias/", ADMIN, {}),
    Fila("GET", f"{P}/categorias/", PUBLICO),
    Fila("GET", f"{P}/categorias/arbol", PUBLICO),
    Fila("GET", f"{P}/categorias/{{categoria_id}}", PUBLICO),
    Fila("PATCH", f"{P}/categorias/{{categoria_id}}", ADMIN, {}),
    Fila("DELETE", f"{P}/categorias/{{categoria_id}}", ADMIN),
    # Productos (26-34)
    Fila("GET", f"{P}/productos/", PUBLICO),
    Fila("GET", f"{P}/productos/{{producto_id}}", PUBLICO),
    Fila("POST", f"{P}/productos/", ADMIN, {}),
    Fila("PUT", f"{P}/productos/{{producto_id}}", ADMIN, {}),
    Fila("PATCH", f"{P}/productos/{{producto_id}}/disponibilidad", ADMIN_STOCK, {"disponible": True}),
    Fila("DELETE", f"{P}/productos/{{producto_id}}", ADMIN),
    Fila("PATCH", f"{P}/productos/{{producto_id}}/imagenes", ADMIN, {}),
    Fila("POST", f"{P}/productos/{{producto_id}}/ingredientes", ADMIN, {}),
    Fila("GET", f"{P}/productos/{{producto_id}}/ingredientes", PUBLICO),
    Fila("DELETE", f"{P}/productos/{{producto_id}}/ingredientes/{{ingrediente_id}}", ADMIN),
    Fila("PATCH", f"{P}/productos/{{producto_id}}/stock", ADMIN_STOCK, {"stock_cantidad": 1}),
    # Ingredientes (35-39)
    Fila("POST", f"{P}/ingredientes/", ADMIN, {}),
    Fila("GET", f"{P}/ingredientes/", PUBLICO),
    Fila("GET", f"{P}/ingredientes/{{ingrediente_id}}", PUBLICO),
    Fila("PATCH", f"{P}/ingredientes/{{ingrediente_id}}", ADMIN, {}),
    Fila("DELETE", f"{P}/ingredientes/{{ingrediente_id}}", ADMIN),
    # Unidades de medida (40-44)
    Fila("POST", f"{P}/unidades-medida/", ADMIN, {}),
    Fila("GET", f"{P}/unidades-medida/", PUBLICO),
    Fila("GET", f"{P}/unidades-medida/{{unidad_id}}", PUBLICO),
    Fila("PATCH", f"{P}/unidades-medida/{{unidad_id}}", ADMIN, {}),
    Fila("DELETE", f"{P}/unidades-medida/{{unidad_id}}", ADMIN),
    # Uploads (45-46)
    Fila("POST", f"{P}/uploads/imagen", ADMIN),
    Fila("DELETE", f"{P}/uploads/imagen/{{public_id:path}}", ADMIN),
    # Pedidos (47-56)
    Fila("POST", f"{P}/pedidos/", CLIENT, {}),
    Fila("GET", f"{P}/pedidos/", CLIENT_ADMIN_PEDIDOS),
    Fila("GET", f"{P}/pedidos/{{pedido_id}}", CLIENT_ADMIN_PEDIDOS),
    Fila("GET", f"{P}/pedidos/{{pedido_id}}/historial", CLIENT_ADMIN_PEDIDOS),
    Fila(
        "PATCH",
        f"{P}/pedidos/{{pedido_id}}/estado",
        ADMIN_PEDIDOS_COCINA,
        {"nuevo_estado": "CONFIRMADO"},
        dueno="C-26 (COCINA)",
    ),
    Fila("DELETE", f"{P}/pedidos/{{pedido_id}}", CLIENT, {"motivo": "x"}),
    Fila("GET", f"{P}/pedidos/cocina/pedidos", ADMIN_PEDIDOS_COCINA, dueno="C-26"),
    # Pagos (C-04: autenticado; la propiedad del pedido se prueba en test_pago_autorizacion.py)
    Fila("POST", f"{P}/pagos/crear", AUTENTICADO, {"pedido_id": ID_INEXISTENTE}),
    Fila("GET", f"{P}/pagos/{{pedido_id}}", AUTENTICADO),
    # Estadísticas (59-63)
    Fila("GET", f"{P}/estadisticas/ventas", ADMIN),
    Fila("GET", f"{P}/estadisticas/productos-top", ADMIN),
    Fila("GET", f"{P}/estadisticas/pedidos-por-estado", ADMIN),
    Fila("GET", f"{P}/estadisticas/ingresos", ADMIN),
    Fila("GET", f"{P}/estadisticas/resumen", ADMIN),
)

# (método o WS, plantilla) -> motivo. Quedan fuera de la matriz a propósito.
EXCLUIDAS: dict[tuple[str, str], str] = {
    ("GET", "/health"): "liveness sin prefijo ni autorización (fila 1)",
    ("POST", "/api/v1/pagos/webhook"): "C-05 (firma); llama a MercadoPago",
    ("GET", "/api/v1/pagos/redirect/{pedido_id}/{status}"): "C-12; no está en la spec",
    ("WS", "/api/v1/pedidos/cocina/ws"): "C-27 (WebSocket)",
    ("WS", "/api/v1/pedidos/{pedido_id}/ws"): "C-27 (WebSocket)",
}

# Perfiles de la matriz: nombre -> roles en la BD (`None` = anónimo).
PERFILES_SIMPLES: dict[str, list[str] | None] = {
    "anonimo": None,
    "CLIENT": ["CLIENT"],
    "STOCK": ["STOCK"],
    "PEDIDOS": ["PEDIDOS"],
    "ADMIN": ["ADMIN"],
}
PERFILES_MULTIROL: dict[str, list[str]] = {
    "CLIENT+STOCK": ["CLIENT", "STOCK"],
    "STOCK+PEDIDOS": ["STOCK", "PEDIDOS"],
    "CLIENT+ADMIN": ["CLIENT", "ADMIN"],
    "PEDIDOS+CLIENT": ["PEDIDOS", "CLIENT"],
    "STOCK+CLIENT+PEDIDOS": ["STOCK", "CLIENT", "PEDIDOS"],
}
