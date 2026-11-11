# order-lifecycle Specification

## Purpose
Define el ciclo de vida de un pedido en el backend: sus seis estados, qué transiciones puede hacer cada actor (roles del usuario o el Sistema), cómo se confirma según la forma de pago, cómo se cancela y cómo queda registrada cada transición en un historial append-only.

## Requirements

### Requirement: Secuencia de seis estados sin saltos
Un pedido SHALL avanzar solo por la secuencia `PENDIENTE → CONFIRMADO → EN_PREP → EN_CAMINO → ENTREGADO`, un paso por vez, sin saltos ni retrocesos. `CANCELADO` es la única salida fuera de la secuencia. Cualquier otro destino SHALL responder 409 y el pedido SHALL quedar en su estado actual.

#### Scenario: Avance de preparación a en camino
- **WHEN** un usuario `PEDIDOS` pide `PATCH /api/v1/pedidos/{id}/estado` con `nuevo_estado` `EN_CAMINO` sobre un pedido en `EN_PREP`
- **THEN** recibe 200 con `estado_codigo` `EN_CAMINO` y el pedido releído está en `EN_CAMINO`

#### Scenario: Entrega desde en camino
- **WHEN** un usuario `ADMIN` pide pasar a `ENTREGADO` un pedido en `EN_CAMINO`
- **THEN** recibe 200 y el pedido queda en `ENTREGADO`

#### Scenario: Sin atajo de preparación a entregado
- **WHEN** un usuario `ADMIN` pide pasar a `ENTREGADO` un pedido en `EN_PREP`
- **THEN** recibe 409 y el pedido sigue en `EN_PREP`

#### Scenario: Sin saltos hacia adelante
- **WHEN** un usuario `PEDIDOS` pide pasar a `EN_CAMINO` un pedido en `CONFIRMADO`
- **THEN** recibe 409 y el pedido sigue en `CONFIRMADO`

#### Scenario: Sin retrocesos
- **WHEN** un usuario `ADMIN` pide pasar a `EN_PREP` un pedido en `EN_CAMINO`
- **THEN** recibe 409 y el pedido sigue en `EN_CAMINO`

#### Scenario: Destino que no existe en el catálogo
- **WHEN** un usuario `ADMIN` pide pasar a `DESPACHADO` un pedido en `EN_PREP`
- **THEN** recibe 400 y el pedido sigue en `EN_PREP`

### Requirement: Estados terminales
`ENTREGADO` y `CANCELADO` SHALL ser terminales: ningún actor SHALL poder sacar un pedido de ellos, y el intento SHALL responder 409 sin cambiar el pedido ni el historial.

#### Scenario: Pedido entregado
- **WHEN** un usuario `ADMIN` pide pasar a `CANCELADO`, con motivo, un pedido en `ENTREGADO`
- **THEN** recibe 409 y el pedido sigue en `ENTREGADO`

#### Scenario: Pedido cancelado
- **WHEN** un usuario `PEDIDOS` pide pasar a `CONFIRMADO` un pedido en `CANCELADO`
- **THEN** recibe 409 y el pedido sigue en `CANCELADO`

### Requirement: Despacho y entrega por ADMIN y PEDIDOS
Las transiciones `CONFIRMADO → EN_PREP`, `EN_PREP → EN_CAMINO` y `EN_CAMINO → ENTREGADO` SHALL estar habilitadas solo para los roles `ADMIN` y `PEDIDOS`, evaluados con la unión de los roles del usuario. Un usuario sin ninguno de esos roles SHALL recibir 409 (si el endpoint lo admite) o 403 (si el endpoint no lo admite), sin cambios en el pedido.

#### Scenario: PEDIDOS despacha
- **WHEN** un usuario con solo el rol `PEDIDOS` pasa a `EN_CAMINO` un pedido en `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `EN_CAMINO`

#### Scenario: Multi-rol despacha por la unión
- **WHEN** un usuario con los roles `STOCK` y `PEDIDOS` pasa a `ENTREGADO` un pedido en `EN_CAMINO`
- **THEN** recibe 200 y el pedido queda en `ENTREGADO`

#### Scenario: COCINA no despacha
- **WHEN** un usuario con solo el rol `COCINA` pide pasar a `EN_CAMINO` un pedido en `EN_PREP`
- **THEN** recibe 409 y el pedido sigue en `EN_PREP`

#### Scenario: CLIENT no usa el endpoint de gestión
- **WHEN** un usuario con solo el rol `CLIENT` pide `PATCH /api/v1/pedidos/{id}/estado` a `EN_CAMINO`
- **THEN** recibe 403 y el pedido no cambia

### Requirement: Confirmación manual solo para efectivo y transferencia
La transición manual `PENDIENTE → CONFIRMADO` SHALL estar permitida solo si el pedido tiene forma de pago `EFECTIVO` o `TRANSFERENCIA` y el usuario tiene el rol `ADMIN` o `PEDIDOS`. Un pedido `MERCADOPAGO` SHALL rechazar la confirmación manual con 409 y un mensaje que indique que se confirma con el pago aprobado. Cualquier otra forma de pago SHALL rechazarla con 409.

#### Scenario: PEDIDOS confirma un pedido en efectivo
- **WHEN** un usuario `PEDIDOS` pasa a `CONFIRMADO` un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** recibe 200 y el pedido queda en `CONFIRMADO`

#### Scenario: ADMIN confirma un pedido por transferencia
- **WHEN** un usuario `ADMIN` pasa a `CONFIRMADO` un pedido `TRANSFERENCIA` en `PENDIENTE`
- **THEN** recibe 200 y el pedido queda en `CONFIRMADO`

#### Scenario: Un pedido de MercadoPago no se confirma a mano
- **WHEN** un usuario `ADMIN` pide pasar a `CONFIRMADO` un pedido `MERCADOPAGO` en `PENDIENTE`
- **THEN** recibe 409 con un `detail` que dice que el pedido se confirma con el pago aprobado, el pedido sigue en `PENDIENTE` y el historial no suma filas

#### Scenario: Forma de pago heredada sin confirmación
- **WHEN** un usuario `ADMIN` pide pasar a `CONFIRMADO` un pedido `TARJETA` en `PENDIENTE`
- **THEN** recibe 409 y el pedido sigue en `PENDIENTE`

#### Scenario: Rol sin permiso de confirmación
- **WHEN** un usuario con solo el rol `COCINA` pide pasar a `CONFIRMADO` un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** recibe 409 y el pedido sigue en `PENDIENTE`

### Requirement: Confirmación automática por pago aprobado como Sistema
Ante un pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE`, el pedido SHALL pasar a `CONFIRMADO` con actor Sistema (historial con `usuario_id` nulo), o a `CANCELADO` con motivo «Sin stock» si el stock no alcanza (ver `order-stock`). El Sistema SHALL hacer solo esas dos transiciones, desde `PENDIENTE` y sobre pedidos `MERCADOPAGO`; sobre otro pedido el estado no SHALL cambiar.

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

### Requirement: Cancelación con motivo en estados permitidos
Pasar un pedido a `CANCELADO` SHALL exigir un `motivo` no vacío; sin motivo SHALL responder 422 sin cambios. El dueño `CLIENT` SHALL poder cancelar su pedido solo en `PENDIENTE` o `CONFIRMADO` (por `DELETE`, el motivo es opcional y por defecto «Cancelado por el cliente»). `ADMIN` y `PEDIDOS` SHALL poder cancelar en `PENDIENTE`, `CONFIRMADO` y `EN_PREP`. Nadie SHALL cancelar un pedido en `EN_CAMINO` (409).

#### Scenario: Cliente cancela su pedido confirmado
- **WHEN** el dueño `CLIENT` cancela con motivo «me arrepentí» su pedido en `CONFIRMADO` por `DELETE /api/v1/pedidos/{id}`
- **THEN** recibe 200 y el pedido queda en `CANCELADO`

#### Scenario: Cliente no cancela en preparación
- **WHEN** el dueño con solo el rol `CLIENT` intenta cancelar con motivo su pedido en `EN_PREP`
- **THEN** recibe 409 y el pedido sigue en `EN_PREP`

#### Scenario: PEDIDOS cancela en preparación
- **WHEN** un usuario `PEDIDOS` pasa a `CANCELADO`, con motivo «sin insumos», un pedido en `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `CANCELADO`

#### Scenario: Nadie cancela un pedido en camino
- **WHEN** un usuario `ADMIN` pide pasar a `CANCELADO`, con motivo, un pedido en `EN_CAMINO`
- **THEN** recibe 409 y el pedido sigue en `EN_CAMINO`

#### Scenario: Cancelación sin motivo
- **WHEN** un usuario `ADMIN` pide pasar a `CANCELADO` un pedido en `PENDIENTE` sin `motivo`
- **THEN** recibe 422 y el pedido sigue en `PENDIENTE`

### Requirement: Historial de cada transición
Cada transición aceptada SHALL insertar exactamente una fila de historial con `estado_desde`, `estado_hacia`, el `usuario_id` del actor (nulo si es el Sistema) y el `motivo` recibido. La creación del pedido SHALL insertar la primera fila con `estado_desde` nulo. Una transición rechazada no SHALL insertar filas.

#### Scenario: Recorrido completo
- **WHEN** un pedido `EFECTIVO` creado por un `CLIENT` se confirma, pasa a `EN_PREP`, a `EN_CAMINO` y a `ENTREGADO` por un usuario `PEDIDOS`
- **THEN** `GET /api/v1/pedidos/{id}/historial` devuelve cinco filas, la primera de nulo a `PENDIENTE` con el `usuario_id` del cliente, y las demás con los pares `PENDIENTE→CONFIRMADO`, `CONFIRMADO→EN_PREP`, `EN_PREP→EN_CAMINO`, `EN_CAMINO→ENTREGADO` y el `usuario_id` del usuario `PEDIDOS`

#### Scenario: Motivo de cancelación registrado
- **WHEN** un usuario `ADMIN` cancela con motivo «cliente no responde» un pedido en `CONFIRMADO`
- **THEN** la última fila del historial va de `CONFIRMADO` a `CANCELADO` con ese motivo y el `usuario_id` del admin

#### Scenario: Rechazo sin fila
- **WHEN** un usuario `ADMIN` intenta pasar a `ENTREGADO` un pedido en `EN_PREP` y recibe 409
- **THEN** el historial del pedido tiene la misma cantidad de filas que antes del intento

### Requirement: Historial append-only y ordenado
Las filas del historial SHALL ser inmutables: el backend no SHALL ofrecer ningún camino que las modifique ni las borre. El historial de un pedido SHALL devolverse en orden cronológico ascendente (`created_at`), y ante igual `created_at`, por identificador ascendente (orden de inserción).

#### Scenario: Orden cronológico
- **WHEN** un `ADMIN` consulta el historial de un pedido que pasó por tres transiciones
- **THEN** las filas vienen ordenadas de la más antigua a la más nueva y cada `estado_desde` coincide con el `estado_hacia` de la fila anterior

#### Scenario: Instantes iguales
- **WHEN** dos filas del historial de un pedido tienen el mismo `created_at`
- **THEN** se devuelven por identificador ascendente

#### Scenario: Sin modificación ni borrado
- **WHEN** el código del backend intenta modificar o borrar una fila de historial a través de su repositorio
- **THEN** la operación falla con un error y la fila sigue igual en la base
