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
