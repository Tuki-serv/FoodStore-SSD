# Spec Delta — rbac-authorization

## MODIFIED Requirements

### Requirement: Transiciones de pedido con todos los roles del usuario
Al cambiar el estado de un pedido, las transiciones permitidas SHALL ser la unión de las que habilita cada rol del usuario. Un rol sin transiciones definidas no aporta ninguna y no SHALL provocar un error 500. Si ningún rol habilita la transición, la respuesta SHALL ser 409. La misma unión SHALL regir la confirmación manual según la forma de pago. Qué transiciones habilita cada rol lo define la capacidad `order-lifecycle`.

#### Scenario: STOCK y PEDIDOS avanzan un pedido
- **WHEN** un usuario con los roles `STOCK` y `PEDIDOS`, asignados en ese orden, llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `EN_PREP`

#### Scenario: CLIENT y ADMIN avanzan un pedido
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN`, asignados en ese orden, llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 200 y el pedido queda en `EN_PREP`

#### Scenario: Rol sin transiciones definidas
- **WHEN** un usuario con solo el rol `COCINA` llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar un pedido de `CONFIRMADO` a `EN_PREP`
- **THEN** recibe 409 (no 500) y el pedido sigue en `CONFIRMADO`

#### Scenario: Confirmación manual por la unión de roles
- **WHEN** un usuario con los roles `CLIENT` y `PEDIDOS`, asignados en ese orden, llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar a `CONFIRMADO` un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** recibe 200 y el pedido queda en `CONFIRMADO`

#### Scenario: La unión de roles no habilita confirmar un pedido de MercadoPago
- **WHEN** un usuario con los roles `PEDIDOS` y `ADMIN` llama a `PATCH /api/v1/pedidos/{id}/estado` para pasar a `CONFIRMADO` un pedido `MERCADOPAGO` en `PENDIENTE`
- **THEN** recibe 409 y el pedido sigue en `PENDIENTE`
