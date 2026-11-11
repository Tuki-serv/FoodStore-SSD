# Spec Delta

## MODIFIED Requirements

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

