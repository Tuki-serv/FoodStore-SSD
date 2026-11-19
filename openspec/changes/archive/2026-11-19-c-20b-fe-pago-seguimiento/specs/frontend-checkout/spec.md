# Spec Delta — frontend-checkout

## ADDED Requirements

### Requirement: Estado del pago en la confirmación
Para un pedido `MERCADOPAGO`, la confirmación `/finalizar-compra/pedido/<id>` SHALL mostrar el estado del último intento de pago (`GET /pagos/{pedido_id}`), con el motivo legible si fue rechazado, y SHALL mantener el CTA «Pagar $ <total> con tarjeta» mientras el pedido esté `PENDIENTE` y el pago no esté `pendiente` ni `aprobado` (tras un rechazo el CTA es «Reintentar el pago de $ <total>», como en el mockup aprobado). Sin intentos no SHALL mostrar nada extra.

#### Scenario: Último intento rechazado
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` `PENDIENTE` y su último intento es `rechazado` con detalle `insufficient_amount`
- **THEN** se ve «Último intento de pago: rechazado», el motivo «La tarjeta no tiene fondos suficientes.» y el CTA «Reintentar el pago de $ 2.850»

#### Scenario: Pago en confirmación
- **WHEN** el último intento del pedido 58 es `pendiente`
- **THEN** se ve «Pago en confirmación» y no se ve «Pagar»

#### Scenario: Sin intentos de pago
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` `PENDIENTE` y `GET /pagos/58` devuelve `estado` `null`
- **THEN** se ve «Pagar $ 2.850 con tarjeta» y ninguna línea de estado del pago

#### Scenario: Pedido que no es con tarjeta
- **WHEN** la confirmación es del pedido 60 `EFECTIVO`
- **THEN** no se pide `GET /pagos/60`
