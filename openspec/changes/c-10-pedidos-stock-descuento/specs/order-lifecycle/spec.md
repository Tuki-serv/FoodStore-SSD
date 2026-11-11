## MODIFIED Requirements

### Requirement: Confirmación automática por pago aprobado como Sistema
Cuando el webhook de pagos procesa un pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE`, el pedido SHALL pasar a `CONFIRMADO` con actor Sistema: la fila de historial SHALL tener `usuario_id` nulo. Si el stock no alcanza para confirmarlo, el pedido SHALL pasar en cambio a `CANCELADO` con motivo «Sin stock» y actor Sistema (ver capability `order-stock`). El Sistema SHALL poder solo esas dos transiciones desde `PENDIENTE` y solo sobre pedidos `MERCADOPAGO`; sobre otro pedido el estado no SHALL cambiar.

#### Scenario: Pago aprobado confirma el pedido
- **WHEN** MercadoPago informa como `approved` el pago pendiente de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente y se recibe la notificación en `POST /api/v1/pagos/webhook`
- **THEN** la respuesta es 200, el pedido queda en `CONFIRMADO` y la última fila de su historial va de `PENDIENTE` a `CONFIRMADO` con `usuario_id` nulo

#### Scenario: Pago aprobado sin stock cancela como Sistema
- **WHEN** el webhook procesa un pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` cuyo producto ya no tiene stock suficiente
- **THEN** la respuesta es 200, el pedido queda en `CANCELADO` y la última fila de su historial va de `PENDIENTE` a `CANCELADO` con motivo «Sin stock» y `usuario_id` nulo

#### Scenario: Pago aprobado de un pedido que no es de MercadoPago
- **WHEN** el webhook procesa un pago aprobado asociado a un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** la respuesta es 200 y el pedido sigue en `PENDIENTE` sin filas nuevas en el historial

#### Scenario: Pago aprobado de un pedido ya cancelado
- **WHEN** el webhook procesa un pago aprobado de un pedido `MERCADOPAGO` en `CANCELADO`
- **THEN** la respuesta es 200 y el pedido sigue en `CANCELADO`

### Requirement: Punto único de entrada a CONFIRMADO
Toda transición a `CONFIRMADO`, manual o automática, SHALL pasar por la misma validación de la FSM y el mismo paso de confirmación —el descuento de stock de la capability `order-stock`—, dentro de la misma transacción que actualiza el estado y escribe el historial. Si ese paso falla, el pedido SHALL seguir en `PENDIENTE`, el historial no SHALL sumar filas y ningún stock SHALL cambiar.

#### Scenario: Confirmación manual y automática registran igual
- **WHEN** un pedido `EFECTIVO` se confirma a mano y un pedido `MERCADOPAGO` se confirma por el webhook, ambos con stock suficiente
- **THEN** ambos quedan en `CONFIRMADO` con exactamente una fila de historial nueva de `PENDIENTE` a `CONFIRMADO` cada uno, el stock baja igual en los dos casos, y solo difieren en el actor

#### Scenario: Falla en el paso de confirmación
- **WHEN** el paso de confirmación falla durante una confirmación manual de un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** la respuesta es un error, el pedido releído sigue en `PENDIENTE`, su historial no tiene una fila hacia `CONFIRMADO` y el stock no cambió
