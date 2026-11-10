"""Literales del esquema esperado, compartidos por los tests de metadata y de migraciones."""

TABLAS_ESPERADAS = frozenset(
    {
        "categorias",
        "detalle_pedido",
        "direccion_entrega",
        "estado_pedido",
        "forma_pago",
        "historial_estado_pedido",
        "ingredientes",
        "pagos",
        "pedidos",
        "producto_categoria",
        "producto_ingrediente",
        "productos",
        "refresh_token",
        "rol",
        "sesion",
        "unidades_medida",
        "usuario",
        "usuario_rol",
    }
)

_TABLAS_AUDITABLES = ("categorias", "ingredientes", "pedidos", "productos", "unidades_medida", "usuario")

COLUMNAS_DE_FECHA_ESPERADAS = frozenset(
    {
        *(f"{tabla}.{campo}" for tabla in _TABLAS_AUDITABLES for campo in ("created_at", "updated_at", "deleted_at")),
        "direccion_entrega.created_at",
        "direccion_entrega.updated_at",
        "direccion_entrega.deleted_at",
        "pagos.created_at",
        "pagos.updated_at",
        "detalle_pedido.created_at",
        "historial_estado_pedido.created_at",
        "producto_categoria.created_at",
        "producto_ingrediente.created_at",
        "usuario_rol.expires_at",
        "usuario_rol.created_at",
        "sesion.expires_at",
        "sesion.revoked_at",
        "sesion.created_at",
        "refresh_token.revoked_at",
        "refresh_token.created_at",
    }
)

FK_A_USUARIO_ESPERADAS = frozenset(
    {
        "usuario_rol.usuario_id",
        "usuario_rol.asignado_por_id",
        "sesion.usuario_id",
        "direccion_entrega.usuario_id",
        "pedidos.usuario_id",
        "historial_estado_pedido.usuario_id",
    }
)

INDICES_UNICOS_PARCIALES = (
    "uq_usuario_email_activo",
    "uq_categorias_nombre_activo",
    "uq_ingredientes_nombre_activo",
    "uq_productos_nombre_activo",
    "uq_unidades_medida_nombre_activo",
    "uq_unidades_medida_simbolo_activo",
)
