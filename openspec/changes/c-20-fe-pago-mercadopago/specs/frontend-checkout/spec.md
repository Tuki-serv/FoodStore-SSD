# Spec Delta — frontend-checkout

## MODIFIED Requirements

### Requirement: Traspaso al pago con tarjeta
Para un pedido `MERCADOPAGO` en estado `PENDIENTE`, la confirmación SHALL explicar que falta pagar con tarjeta para que el pedido se confirme y SHALL ofrecer «Pagar $ <total> con tarjeta», que navega a `/finalizar-compra/pedido/<id>/pago`. Esa ruta (solo `CLIENT`) SHALL mostrar la página de pago con tarjeta (capability `frontend-payment`).

#### Scenario: Pagar con tarjeta
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` con total `"2850.00"` y el cliente pulsa «Pagar $ 2.850 con tarjeta»
- **THEN** la URL pasa a `/finalizar-compra/pedido/58/pago`

#### Scenario: Ruta de pago provisoria
- **WHEN** el cliente abre `/finalizar-compra/pedido/58/pago`
- **THEN** ve el título «Pagar pedido #58» y no la página provisoria (el nombre del escenario se conserva de C-19; la página provisoria ya no existe)

## ADDED Requirements

### Requirement: Estado del pago en la confirmación
Para un pedido `MERCADOPAGO`, la confirmación `/finalizar-compra/pedido/<id>` SHALL mostrar el estado del último intento de pago (`GET /pagos/{pedido_id}`), con el motivo legible si fue rechazado, y SHALL mantener el CTA «Pagar $ <total> con tarjeta» mientras el pedido esté `PENDIENTE` y el pago no esté `pendiente` ni `aprobado`. Sin intentos no SHALL mostrar nada extra. *(Sujeto a OQ-7.)*

#### Scenario: Último intento rechazado
- **WHEN** la confirmación es del pedido 58 `MERCADOPAGO` `PENDIENTE` y su último intento es `rechazado` con detalle `insufficient_amount`
- **THEN** se ve «Último intento de pago: rechazado», el motivo «La tarjeta no tiene fondos suficientes.» y «Pagar $ 2.850 con tarjeta»

#### Scenario: Pago en confirmación
- **WHEN** el último intento del pedido 58 es `pendiente`
- **THEN** se ve «Pago en confirmación» y no se ve «Pagar»
