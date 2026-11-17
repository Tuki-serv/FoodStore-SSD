## MODIFIED Requirements

### Requirement: Códigos de error de negocio
Los errores que el cliente debe distinguir SHALL usar códigos de negocio estables: `INVALID_TRANSITION` (409, transición no permitida o pedido terminal), `INSUFFICIENT_STOCK` (409, confirmación sin stock), `DUPLICATE_VALUE` (409, con `field`), `CATEGORY_HAS_PRODUCTS` (409), `CATEGORY_HAS_CHILDREN` (409) y `PAYMENT_NOT_ALLOWED` (409, el pedido no admite un nuevo pago: no es `MERCADOPAGO`, no está `PENDIENTE`, ya está pagado o tiene un pago en proceso).

#### Scenario: Transición inválida
- **WHEN** un usuario `ADMIN` pide pasar a `ENTREGADO` un pedido en `EN_PREP`
- **THEN** recibe 409 con `code` `INVALID_TRANSITION`

#### Scenario: Confirmación sin stock
- **WHEN** un usuario `PEDIDOS` confirma un pedido `EFECTIVO` de 2 unidades de un producto con stock 1
- **THEN** recibe 409 con `code` `INSUFFICIENT_STOCK` y el pedido sigue en `PENDIENTE`

#### Scenario: Pago no permitido
- **WHEN** el dueño de un pedido `TRANSFERENCIA` en `PENDIENTE` llama a `POST /api/v1/pagos/crear` con ese pedido
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y `field` nulo
