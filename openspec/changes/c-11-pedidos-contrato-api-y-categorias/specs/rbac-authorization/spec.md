# Spec Delta

## MODIFIED Requirements

### Requirement: Matriz de permisos de ADMIN, PEDIDOS y CLIENT
`ADMIN` SHALL acceder a todos los endpoints de administración. `PEDIDOS` SHALL acceder al listado y la gestión de pedidos, sin escritura de catálogo, usuarios ni estadísticas. `CLIENT` SHALL operar solo sus pedidos y su perfil, sin acceso a endpoints de administración: en `GET /api/v1/pedidos` ve solo los propios. Un usuario con varios roles SHALL acceder a la unión de lo que habilita cada uno.

#### Scenario: PEDIDOS sin escritura de catálogo
- **WHEN** un usuario con solo el rol `PEDIDOS` llama a `PATCH /api/v1/productos/{id}/stock` o a `POST /api/v1/categorias/`
- **THEN** cada uno responde 403

#### Scenario: CLIENT sin endpoints de administración
- **WHEN** un usuario con solo el rol `CLIENT` llama a `PATCH /api/v1/pedidos/{id}/estado`, `GET /api/v1/pedidos/cocina/pedidos`, `GET /api/v1/admin/usuarios/` o `GET /api/v1/estadisticas/resumen`
- **THEN** cada uno responde 403

#### Scenario: CLIENT lista solo sus pedidos
- **WHEN** un usuario con solo el rol `CLIENT` llama a `GET /api/v1/pedidos/` y existen pedidos de otros clientes
- **THEN** recibe 200 y todos los `items` son pedidos propios

#### Scenario: ADMIN accede a la administración
- **WHEN** un usuario con solo el rol `ADMIN` llama a `PATCH /api/v1/productos/{id}/stock`, `GET /api/v1/pedidos/` y `GET /api/v1/admin/usuarios/`
- **THEN** ninguna respuesta es 401 ni 403

#### Scenario: Unión de PEDIDOS y STOCK
- **WHEN** un usuario con los roles `PEDIDOS` y `STOCK` llama a `GET /api/v1/pedidos/` y a `PATCH /api/v1/productos/{id}/stock`
- **THEN** ambos responden 200, y `POST /api/v1/categorias/` sigue respondiendo 403

### Requirement: Cancelación del pedido propio con todos los roles del usuario
La cancelación de un pedido propio SHALL evaluar la transición a `CANCELADO` con la unión de los roles del usuario, sin errores por roles sin transiciones definidas. El endpoint (`DELETE /api/v1/pedidos/{id}`) sigue exigiendo el rol `CLIENT` y que el pedido sea del usuario.

#### Scenario: STOCK y CLIENT cancelan su pedido
- **WHEN** un usuario con los roles `STOCK` y `CLIENT`, asignados en ese orden, cancela con motivo su pedido `PENDIENTE` por `DELETE /api/v1/pedidos/{id}`
- **THEN** recibe 200 y el pedido queda `CANCELADO`

#### Scenario: CLIENT no cancela un pedido en preparación
- **WHEN** un usuario con solo el rol `CLIENT` intenta cancelar su pedido en `EN_PREP`
- **THEN** recibe 409 y el pedido sigue en `EN_PREP`

#### Scenario: CLIENT y ADMIN cancelan su pedido en preparación
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN` cancela con motivo su propio pedido en `EN_PREP` por `DELETE /api/v1/pedidos/{id}`
- **THEN** recibe 200 y el pedido queda `CANCELADO`, porque el rol `ADMIN` habilita esa transición
