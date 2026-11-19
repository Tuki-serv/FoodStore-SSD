# Spec Delta — frontend-payment

## ADDED Requirements

### Requirement: Reconstrucción de la vista al recargar
Al abrir o recargar la página de pago de un pedido `MERCADOPAGO`, la página SHALL consultar el último intento de pago (`GET /pagos/{pedido_id}`) junto con el pedido y SHALL mostrar la vista que corresponde a ese intento (aprobado, rechazado con su motivo y el formulario, pendiente o aprobado sin stock), de modo que una recarga muestre el mismo resultado que se veía antes. Para pedidos que no son `MERCADOPAGO` no SHALL consultar el pago.

#### Scenario: Recarga con pago aprobado
- **WHEN** el cliente recarga la página del pedido 58 y el último intento es `aprobado` con el pedido `CONFIRMADO`
- **THEN** ve «¡Pago aprobado!» y no ve el formulario de tarjeta

#### Scenario: Recarga tras un rechazo
- **WHEN** el último intento del pedido 58 es `rechazado` con detalle `cc_rejected_insufficient_amount` y el pedido sigue `PENDIENTE`
- **THEN** ve el motivo «La tarjeta no tiene fondos suficientes.» y el formulario de tarjeta para reintentar

#### Scenario: Recarga con pago pendiente
- **WHEN** el último intento del pedido 58 es `pendiente` y el pedido sigue `PENDIENTE`
- **THEN** ve «Estamos esperando la confirmación de Mercado Pago» y no ve el formulario de tarjeta

#### Scenario: Pedido en efectivo
- **WHEN** el cliente abre la página de pago del pedido 60 `EFECTIVO`
- **THEN** ve «Este pedido no se paga con tarjeta» y no se pide `GET /pagos/60`

### Requirement: Seguimiento del pago pendiente
Con el pago `pendiente`, la página SHALL consultar `GET /pagos/{pedido_id}` periódicamente hasta un estado terminal (`aprobado`, `rechazado`, `a_devolver`) o hasta el tope de espera, y SHALL mostrar la vista del nuevo estado en cuanto llegue. Al llegar a un estado terminal SHALL dejar de consultar e invalidar el detalle y la lista de pedidos. El intervalo y el tope son los de design D2.

#### Scenario: Pendiente que se aprueba
- **WHEN** `POST /pagos/crear` responde `pendiente` y una consulta posterior de `GET /pagos/58` responde `aprobado`
- **THEN** la vista pasa de «Estamos esperando la confirmación de Mercado Pago» a «¡Pago aprobado!» y deja de consultar

#### Scenario: Pendiente que se rechaza
- **WHEN** la consulta pasa de `pendiente` a `rechazado`
- **THEN** se ve «El pago fue rechazado» con la opción de reintentar

#### Scenario: Pendiente aprobado sin stock
- **WHEN** la consulta pasa de `pendiente` a `a_devolver`
- **THEN** se ve «Tu pago se aprobó, pero no pudimos confirmar el pedido» y deja de consultar

### Requirement: Tope de espera del pago pendiente
Si el pago sigue `pendiente` al cumplirse el tope de espera, la página SHALL dejar de consultar y mostrar «La confirmación está demorando» con «Actualizar» (una consulta manual) y «Ver mi pedido».

#### Scenario: Tope de espera
- **WHEN** el pago sigue `pendiente` al cumplirse el tope de espera
- **THEN** se ve «La confirmación está demorando», deja de consultar y «Actualizar» hace una consulta más
