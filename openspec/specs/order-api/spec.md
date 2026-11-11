# order-api Specification

## Purpose

Define la superficie HTTP de pedidos que consume el frontend: qué endpoints existen, quién accede a cada uno, qué reciben y con qué forma responden. Las reglas de transición y de stock las definen `order-lifecycle` y `order-stock`; acá solo se las expone.

## Requirements

### Requirement: Listado de pedidos según el alcance del lector
`GET /api/v1/pedidos` SHALL estar disponible para `CLIENT`, `ADMIN` y `PEDIDOS` (otros roles: 403). Si los roles del usuario incluyen `ADMIN` o `PEDIDOS`, SHALL listar los pedidos de todos los clientes; si no, solo los propios. El orden SHALL ser del más nuevo al más viejo (`created_at` descendente y, a igual instante, `id` descendente).

#### Scenario: Cliente ve solo sus pedidos
- **WHEN** existen 2 pedidos del cliente A y 3 del cliente B, y A llama a `GET /api/v1/pedidos`
- **THEN** recibe 200 con `total` 2 y solo pedidos de A

#### Scenario: Gestor ve todos
- **WHEN** en el mismo escenario un usuario `PEDIDOS` llama a `GET /api/v1/pedidos`
- **THEN** recibe 200 con `total` 5

#### Scenario: Unión de CLIENT y PEDIDOS
- **WHEN** un usuario con los roles `CLIENT` y `PEDIDOS` llama a `GET /api/v1/pedidos`
- **THEN** recibe todos los pedidos, no solo los propios

#### Scenario: STOCK no lista pedidos
- **WHEN** un usuario con solo el rol `STOCK` llama a `GET /api/v1/pedidos`
- **THEN** recibe 403

### Requirement: Filtros del listado de pedidos
`GET /api/v1/pedidos` SHALL aceptar los filtros opcionales `estado` (uno de los seis códigos de estado; otro valor responde 422), `desde` y `hasta` (fechas `YYYY-MM-DD`, inclusivas, sobre la fecha de creación). Los filtros SHALL combinarse con el alcance del lector y nunca ampliarlo; `total` SHALL contar solo lo filtrado.

#### Scenario: Filtro por estado
- **WHEN** existen 2 pedidos `PENDIENTE` y 1 `CONFIRMADO`, y un `ADMIN` llama a `GET /api/v1/pedidos?estado=PENDIENTE`
- **THEN** recibe `total` 2 y todos los `items` tienen `estado_codigo` `PENDIENTE`

#### Scenario: Filtro por rango de fechas
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?desde=2026-11-01&hasta=2026-11-01` y hay un pedido creado ese día y otro el día siguiente
- **THEN** recibe solo el pedido creado el 2026-11-01

#### Scenario: Estado desconocido
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?estado=DESPACHADO`
- **THEN** recibe 422 con `field` `estado`

### Requirement: Forma de cada pedido del listado
Cada elemento de `items` en `GET /api/v1/pedidos` SHALL tener `id`, `usuario_id`, `cliente_nombre`, `estado_codigo`, `forma_pago_codigo`, `subtotal`, `descuento`, `costo_envio`, `total`, `notas` y `created_at`, sin las líneas del pedido. Los importes SHALL serializarse como decimales exactos.

#### Scenario: Elemento del listado
- **WHEN** un `ADMIN` lista pedidos y uno es del cliente «Ana»
- **THEN** ese elemento trae `cliente_nombre` «Ana», su `usuario_id` y no trae la clave `items`

### Requirement: Detalle de un pedido para el propietario y los gestores
`GET /api/v1/pedidos/{id}` SHALL responder 200 al dueño del pedido y a usuarios con `ADMIN` o `PEDIDOS`, con los campos del listado más `direccion_id` e `items` (líneas con sus snapshots). Otro usuario con rol `CLIENT` SHALL recibir 403; un rol sin acceso a pedidos, 403; un pedido inexistente, 404.

#### Scenario: Dueño ve su pedido
- **WHEN** el cliente A llama a `GET /api/v1/pedidos/{id}` de su pedido con dos líneas
- **THEN** recibe 200 con `usuario_id` de A e `items` con dos líneas

#### Scenario: Otro cliente
- **WHEN** el cliente B llama a `GET /api/v1/pedidos/{id}` de un pedido de A
- **THEN** recibe 403 y el cuerpo no incluye datos del pedido

#### Scenario: Gestor ve cualquier pedido
- **WHEN** un usuario `PEDIDOS` llama a `GET /api/v1/pedidos/{id}` de un pedido de A
- **THEN** recibe 200

### Requirement: Historial para el propietario y los gestores
`GET /api/v1/pedidos/{id}/historial` SHALL aplicar el mismo acceso que el detalle (dueño, `ADMIN`, `PEDIDOS`; otro cliente 403; inexistente 404) y devolver la lista de filas `{id, pedido_id, estado_desde, estado_hacia, motivo, usuario_id, created_at}` en el orden que define `order-lifecycle`.

#### Scenario: Dueño ve su historial
- **WHEN** el cliente A llama a `GET /api/v1/pedidos/{id}/historial` de su pedido recién creado
- **THEN** recibe 200 con una fila de nulo a `PENDIENTE`

#### Scenario: Otro cliente no ve el historial
- **WHEN** el cliente B llama al historial de un pedido de A
- **THEN** recibe 403

### Requirement: Cambio de estado con nuevo_estado
`PATCH /api/v1/pedidos/{id}/estado` SHALL recibir `{nuevo_estado, motivo}` (`motivo` opcional salvo para `CANCELADO`) y responder 200 con el detalle del pedido. Sin `nuevo_estado`, o `CANCELADO` sin `motivo`, SHALL responder 422. Las transiciones permitidas, los roles y el stock SHALL ser los de `order-lifecycle` y `order-stock`, sin reglas propias del endpoint.

#### Scenario: Avance con el contrato nuevo
- **WHEN** un usuario `PEDIDOS` envía `{"nuevo_estado": "EN_PREP"}` sobre un pedido `CONFIRMADO`
- **THEN** recibe 200 con `estado_codigo` `EN_PREP` e `items`

#### Scenario: Campo anterior rechazado
- **WHEN** un usuario `ADMIN` envía `{"estado_hacia": "EN_PREP"}` sobre un pedido `CONFIRMADO`
- **THEN** recibe 422 con `field` `nuevo_estado` y el pedido sigue en `CONFIRMADO`

#### Scenario: Cancelar sin motivo
- **WHEN** un usuario `ADMIN` envía `{"nuevo_estado": "CANCELADO"}` sobre un pedido `PENDIENTE`
- **THEN** recibe 422 con `field` `motivo` y el pedido sigue en `PENDIENTE`

### Requirement: DELETE cancela el pedido propio
`DELETE /api/v1/pedidos/{id}` SHALL estar disponible solo para `CLIENT` y SHALL cancelar el pedido del propio usuario con el `motivo` del body opcional `{motivo}`; sin body, o con `motivo` ausente o vacío, SHALL usar «Cancelado por el cliente». SHALL responder 200 con el detalle del pedido en `CANCELADO`. Pedido ajeno: 403; inexistente: 404; estado no cancelable para sus roles: 409 `INVALID_TRANSITION`.

#### Scenario: Cliente cancela su pedido pendiente
- **WHEN** el cliente A envía `DELETE /api/v1/pedidos/{id}` con `{"motivo": "me arrepentí"}` sobre su pedido `PENDIENTE`
- **THEN** recibe 200 con `estado_codigo` `CANCELADO`, y el historial suma una fila `PENDIENTE→CANCELADO` con ese motivo y su `usuario_id`

#### Scenario: Pedido ajeno
- **WHEN** el cliente B envía `DELETE /api/v1/pedidos/{id}` con motivo sobre un pedido de A
- **THEN** recibe 403 y el pedido no cambia

#### Scenario: Sin body
- **WHEN** el cliente A envía `DELETE /api/v1/pedidos/{id}` sin body sobre su pedido `PENDIENTE`
- **THEN** recibe 200 `CANCELADO` y el historial registra el motivo «Cancelado por el cliente»

#### Scenario: Motivo vacío
- **WHEN** el cliente A envía `DELETE /api/v1/pedidos/{id}` con `{"motivo": "  "}` sobre su pedido `PENDIENTE`
- **THEN** recibe 200 `CANCELADO` y el historial registra el motivo «Cancelado por el cliente»

#### Scenario: ADMIN no borra pedidos
- **WHEN** un usuario con solo el rol `ADMIN` envía `DELETE /api/v1/pedidos/{id}`
- **THEN** recibe 403 y el pedido no se cancela ni se marca eliminado

### Requirement: Los pedidos no se borran por API
Ningún endpoint SHALL marcar un pedido como eliminado ni borrarlo. La cancelación es la única forma de retirarlo del circuito y deja el pedido y su historial consultables.

#### Scenario: Pedido cancelado sigue visible
- **WHEN** un cliente cancela su pedido por `DELETE /api/v1/pedidos/{id}`
- **THEN** `GET /api/v1/pedidos/{id}` sigue respondiendo 200 y el pedido aparece en `GET /api/v1/pedidos`

### Requirement: Listado de cocina paginado
`GET /api/v1/pedidos/cocina/pedidos` SHALL listar, paginado, solo los pedidos en `CONFIRMADO` o `EN_PREP`, del más viejo al más nuevo, con la forma de elemento del listado general. `total` SHALL contar todos los pedidos en esos estados, no solo la página.

#### Scenario: Filtro antes de paginar
- **WHEN** existen 25 pedidos `ENTREGADO` más nuevos y 3 `CONFIRMADO` más viejos, y un `ADMIN` llama a `GET /api/v1/pedidos/cocina/pedidos`
- **THEN** recibe los 3 `CONFIRMADO` con `total` 3

### Requirement: Rutas de pedidos retiradas
Las rutas `GET /api/v1/pedidos/mis-pedidos`, `GET /api/v1/pedidos/mis-pedidos/{id}` y `PATCH /api/v1/pedidos/mis-pedidos/{id}/cancelar` SHALL dejar de existir, sin alias.

#### Scenario: Ruta vieja de cancelación
- **WHEN** el dueño `CLIENT` llama a `PATCH /api/v1/pedidos/mis-pedidos/{id}/cancelar` con motivo
- **THEN** no recibe 200 y el pedido no cambia de estado

#### Scenario: Ruta vieja de listado
- **WHEN** un `CLIENT` llama a `GET /api/v1/pedidos/mis-pedidos`
- **THEN** no recibe 200
