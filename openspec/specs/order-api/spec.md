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
`GET /api/v1/pedidos` SHALL aceptar los filtros opcionales `estado` (uno de los seis códigos de estado; otro valor responde 422), `desde` y `hasta` (fechas `YYYY-MM-DD`, inclusivas, sobre la fecha de creación) y `propios` (booleano, por defecto `false`; con `true` el listado se limita a los pedidos del usuario aunque sus roles le den alcance sobre todos). Los filtros SHALL combinarse con el alcance del lector y nunca ampliarlo; `total` SHALL contar solo lo filtrado.

#### Scenario: Filtro por estado
- **WHEN** existen 2 pedidos `PENDIENTE` y 1 `CONFIRMADO`, y un `ADMIN` llama a `GET /api/v1/pedidos?estado=PENDIENTE`
- **THEN** recibe `total` 2 y todos los `items` tienen `estado_codigo` `PENDIENTE`

#### Scenario: Filtro por rango de fechas
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?desde=2026-11-01&hasta=2026-11-01` y hay un pedido creado ese día y otro el día siguiente
- **THEN** recibe solo el pedido creado el 2026-11-01

#### Scenario: Estado desconocido
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?estado=DESPACHADO`
- **THEN** recibe 422 con `field` `estado`

#### Scenario: Solo los propios para un gestor
- **WHEN** existen 2 pedidos del usuario U (roles `CLIENT` y `PEDIDOS`) y 3 del cliente B, y U llama a `GET /api/v1/pedidos?propios=true`
- **THEN** recibe `total` 2 y solo pedidos de U

#### Scenario: Propios para un cliente
- **WHEN** el cliente A llama a `GET /api/v1/pedidos?propios=true`
- **THEN** recibe lo mismo que sin el filtro: solo sus pedidos

#### Scenario: Propios combinado con estado
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN`, con 1 pedido propio `PENDIENTE` y 1 propio `ENTREGADO` llama a `GET /api/v1/pedidos?propios=true&estado=PENDIENTE`
- **THEN** recibe `total` 1

### Requirement: Forma de cada pedido del listado
Cada elemento de `items` en `GET /api/v1/pedidos` SHALL tener `id`, `usuario_id`, `cliente_nombre`, `estado_codigo`, `forma_pago_codigo`, `subtotal`, `descuento`, `costo_envio`, `total`, `notas` y `created_at`, sin las líneas del pedido. Los importes SHALL serializarse como decimales exactos.

#### Scenario: Elemento del listado
- **WHEN** un `ADMIN` lista pedidos y uno es del cliente «Ana»
- **THEN** ese elemento trae `cliente_nombre` «Ana», su `usuario_id` y no trae la clave `items`

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

### Requirement: La dirección del pedido pertenece al cliente
`POST /api/v1/pedidos/` con `direccion_id` SHALL aceptar solo una dirección activa del usuario que crea el pedido. Si la dirección no existe, está dada de baja o es de otro usuario, SHALL responder 404 con `code` `ADDRESS_NOT_FOUND` y `field` `direccion_id`, sin crear el pedido ni revelar si la dirección existe. `direccion_id` nulo (retiro en el local) SHALL seguir aceptándose.

#### Scenario: Dirección de otro usuario
- **WHEN** un `CLIENT` crea un pedido con el `direccion_id` de una dirección activa de otro cliente
- **THEN** recibe 404 con `code` `ADDRESS_NOT_FOUND` y `field` `direccion_id`, y no se crea ningún pedido

#### Scenario: Dirección inexistente
- **WHEN** un `CLIENT` crea un pedido con un `direccion_id` que no existe
- **THEN** recibe 404 con `code` `ADDRESS_NOT_FOUND`, no un 500

#### Scenario: Dirección dada de baja
- **WHEN** un `CLIENT` crea un pedido con una dirección propia eliminada
- **THEN** recibe 404 con `code` `ADDRESS_NOT_FOUND`

#### Scenario: Dirección propia activa
- **WHEN** un `CLIENT` crea un pedido con una dirección propia activa
- **THEN** recibe 201 y el detalle del pedido muestra esa dirección

#### Scenario: Retiro en el local
- **WHEN** un `CLIENT` crea un pedido con `direccion_id` nulo
- **THEN** recibe 201 y el pedido queda sin dirección

### Requirement: La personalización solo quita ingredientes removibles del producto
Cada id de `items[].personalizacion` en `POST /api/v1/pedidos/` SHALL corresponder a un ingrediente asociado a ese producto y marcado como removible. Si alguno no lo es, SHALL responder 400 con `code` `INVALID_CUSTOMIZATION` y `field` `items.<índice>.personalizacion` de la primera línea inválida, sin crear el pedido.

#### Scenario: Ingrediente de otro producto
- **WHEN** un `CLIENT` pide un producto con un id de personalización que pertenece a otro producto
- **THEN** recibe 400 con `code` `INVALID_CUSTOMIZATION` y `field` `items.0.personalizacion`

#### Scenario: Ingrediente no removible
- **WHEN** un `CLIENT` pide quitar un ingrediente del producto marcado como no removible
- **THEN** recibe 400 con `code` `INVALID_CUSTOMIZATION`

#### Scenario: Ingrediente inexistente
- **WHEN** un `CLIENT` envía en `personalizacion` un id que no existe
- **THEN** recibe 400 con `code` `INVALID_CUSTOMIZATION`, no un pedido con el id ignorado

#### Scenario: Personalización válida
- **WHEN** un `CLIENT` pide quitar un ingrediente removible del producto
- **THEN** recibe 201 y la línea guarda el nombre del ingrediente quitado en su snapshot

### Requirement: Rechazos de la creación con código y campo estables
Cada rechazo de negocio de `POST /api/v1/pedidos/` SHALL conservar su status HTTP actual y llevar un `code` estable y el `field` afectado: producto inexistente o eliminado 404 `PRODUCT_NOT_FOUND`; producto no disponible 400 `PRODUCT_UNAVAILABLE`; stock insuficiente 400 `INSUFFICIENT_STOCK`; líneas repetidas 400 `DUPLICATE_ITEM`. Los de línea usan `field` `items.<índice>.producto_id`.

#### Scenario: Producto inexistente en la segunda línea
- **WHEN** un `CLIENT` crea un pedido cuya segunda línea tiene un producto que no existe
- **THEN** recibe 404 con `code` `PRODUCT_NOT_FOUND` y `field` `items.1.producto_id`

#### Scenario: Producto no disponible
- **WHEN** un `CLIENT` crea un pedido con un producto `disponible = false`
- **THEN** recibe 400 con `code` `PRODUCT_UNAVAILABLE` y el `field` de esa línea

#### Scenario: Stock insuficiente al crear
- **WHEN** un `CLIENT` pide 6 unidades de un producto con stock 5
- **THEN** recibe 400 con `code` `INSUFFICIENT_STOCK` y el `field` de la primera línea de ese producto

#### Scenario: Líneas repetidas
- **WHEN** un `CLIENT` envía dos líneas con el mismo producto y la misma personalización
- **THEN** recibe 400 con `code` `DUPLICATE_ITEM` y el `field` de la segunda línea

### Requirement: Forma de pago inválida con código estable
Si `forma_pago_codigo` de `POST /api/v1/pedidos/` no existe o no está habilitada, la API SHALL responder con su status actual y `code` `PAYMENT_METHOD_UNAVAILABLE` con `field` `forma_pago_codigo`, sin crear el pedido.

#### Scenario: Forma de pago deshabilitada
- **WHEN** un `CLIENT` crea un pedido con una forma de pago deshabilitada
- **THEN** recibe un error con `code` `PAYMENT_METHOD_UNAVAILABLE` y `field` `forma_pago_codigo`

#### Scenario: Forma de pago inexistente
- **WHEN** un `CLIENT` crea un pedido con `forma_pago_codigo` `BITCOIN`
- **THEN** recibe un error con `code` `PAYMENT_METHOD_UNAVAILABLE` y no se crea el pedido
