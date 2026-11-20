# Spec Delta — order-api

## MODIFIED Requirements

### Requirement: Detalle de un pedido para el propietario y los gestores
`GET /api/v1/pedidos/{id}` SHALL responder 200 al dueño del pedido y a usuarios con `ADMIN` o `PEDIDOS`, con los campos del listado más `direccion_id`, `direccion` (resumen de la dirección de entrega `{id, alias, linea1, linea2, ciudad, provincia, codigo_postal}`, o `null` si el pedido no tiene dirección) e `items` (líneas con sus snapshots). Otro usuario con rol `CLIENT` SHALL recibir 403; un rol sin acceso a pedidos, 403; un pedido inexistente, 404.

#### Scenario: Dueño ve su pedido
- **WHEN** el cliente A llama a `GET /api/v1/pedidos/{id}` de su pedido con dos líneas
- **THEN** recibe 200 con `usuario_id` de A e `items` con dos líneas

#### Scenario: Otro cliente
- **WHEN** el cliente B llama a `GET /api/v1/pedidos/{id}` de un pedido de A
- **THEN** recibe 403 y el cuerpo no incluye datos del pedido

#### Scenario: Gestor ve cualquier pedido
- **WHEN** un usuario `PEDIDOS` llama a `GET /api/v1/pedidos/{id}` de un pedido de A
- **THEN** recibe 200

#### Scenario: Gestor ve la dirección de entrega
- **WHEN** un usuario `PEDIDOS` llama a `GET /api/v1/pedidos/{id}` de un pedido de A con entrega en su dirección «Casa» (`linea1` «Av. Siempre Viva 742», `ciudad` «Springfield»)
- **THEN** recibe 200 con `direccion.alias` «Casa», `direccion.linea1` «Av. Siempre Viva 742» y `direccion.ciudad` «Springfield», aunque esa dirección no sea suya

#### Scenario: Pedido para retirar
- **WHEN** un usuario `ADMIN` llama a `GET /api/v1/pedidos/{id}` de un pedido con `direccion_id` nulo
- **THEN** recibe 200 con `direccion` nulo

### Requirement: Historial para el propietario y los gestores
`GET /api/v1/pedidos/{id}/historial` SHALL aplicar el mismo acceso que el detalle (dueño, `ADMIN`, `PEDIDOS`; otro cliente 403; inexistente 404) y devolver la lista de filas `{id, pedido_id, estado_desde, estado_hacia, motivo, usuario_id, usuario_nombre, created_at}` en el orden que define `order-lifecycle`. `usuario_nombre` SHALL ser el nombre del usuario que hizo el cambio, o `null` cuando lo hizo el Sistema.

#### Scenario: Dueño ve su historial
- **WHEN** el cliente A llama a `GET /api/v1/pedidos/{id}/historial` de su pedido recién creado
- **THEN** recibe 200 con una fila de nulo a `PENDIENTE`

#### Scenario: Otro cliente no ve el historial
- **WHEN** el cliente B llama al historial de un pedido de A
- **THEN** recibe 403

#### Scenario: Nombre de quien hizo el cambio
- **WHEN** la gestora «Carla» confirmó a mano un pedido `EFECTIVO` y un `ADMIN` llama a su historial
- **THEN** la fila `PENDIENTE→CONFIRMADO` trae `usuario_nombre` «Carla» y su `usuario_id`

#### Scenario: Cambio hecho por el Sistema
- **WHEN** un pedido `MERCADOPAGO` se confirmó por pago aprobado y su dueño llama al historial
- **THEN** la fila `PENDIENTE→CONFIRMADO` trae `usuario_id` y `usuario_nombre` nulos
