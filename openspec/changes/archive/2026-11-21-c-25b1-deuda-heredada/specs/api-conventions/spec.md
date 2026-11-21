# Spec Delta

## MODIFIED Requirements

### Requirement: Códigos de error de negocio
Los errores que el cliente debe distinguir SHALL usar códigos de negocio estables: `INVALID_TRANSITION` (409, transición no permitida o pedido terminal), `INSUFFICIENT_STOCK` (409, confirmación sin stock; 400, creación de pedido sin stock), `DUPLICATE_VALUE` (409, con `field`), `CATEGORY_HAS_PRODUCTS` (409), `CATEGORY_HAS_CHILDREN` (409) y `PAYMENT_NOT_ALLOWED` (409, el pedido no admite un nuevo pago: no es `MERCADOPAGO`, no está `PENDIENTE`, ya está pagado o tiene un pago en proceso). La creación de pedidos SHALL usar además `PRODUCT_NOT_FOUND` (404), `PRODUCT_UNAVAILABLE` (400), `DUPLICATE_ITEM` (400), `PAYMENT_METHOD_UNAVAILABLE` (400), `ADDRESS_NOT_FOUND` (404) e `INVALID_CUSTOMIZATION` (400), todos con `field`.

#### Scenario: Transición inválida
- **WHEN** un usuario `ADMIN` pide pasar a `ENTREGADO` un pedido en `EN_PREP`
- **THEN** recibe 409 con `code` `INVALID_TRANSITION`

#### Scenario: Confirmación sin stock
- **WHEN** un usuario `PEDIDOS` confirma un pedido `EFECTIVO` de 2 unidades de un producto con stock 1
- **THEN** recibe 409 con `code` `INSUFFICIENT_STOCK` y el pedido sigue en `PENDIENTE`

#### Scenario: Pago no permitido
- **WHEN** el dueño de un pedido `TRANSFERENCIA` en `PENDIENTE` llama a `POST /api/v1/pagos/crear` con ese pedido
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y `field` nulo

#### Scenario: Creación con producto inexistente
- **WHEN** un `CLIENT` crea un pedido con un producto que no existe en su primera línea
- **THEN** recibe 404 con `code` `PRODUCT_NOT_FOUND` y `field` `items.0.producto_id`

#### Scenario: Creación sin stock
- **WHEN** un `CLIENT` crea un pedido de 3 unidades de un producto con stock 2
- **THEN** recibe 400 con `code` `INSUFFICIENT_STOCK`
