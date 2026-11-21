# Spec Delta

## ADDED Requirements

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
