# Spec Delta

## ADDED Requirements

### Requirement: Pagos del pedido propio, o de cualquiera con ADMIN
Crear y consultar el pago de un pedido SHALL estar disponible para cualquier usuario autenticado y activo, y la autorización SHALL decidirse por el pedido: su dueño y quien tenga `ADMIN` entre sus roles (unión, leídos de la base) acceden; el resto recibe 403. `PEDIDOS` y `STOCK` no SHALL dar acceso a pagos de pedidos ajenos. El 403 SHALL ser neutral (no revela roles ni datos del pedido).

#### Scenario: CLIENT sobre su pedido
- **WHEN** un usuario con solo el rol `CLIENT` consulta `GET /api/v1/pagos/{pedido_id}` de su propio pedido
- **THEN** recibe 200

#### Scenario: CLIENT sobre un pedido ajeno
- **WHEN** un usuario con solo el rol `CLIENT` consulta `GET /api/v1/pagos/{pedido_id}` de un pedido de otro cliente
- **THEN** recibe 403 con `detail` neutral

#### Scenario: Unión de CLIENT y ADMIN
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN` consulta el pago de un pedido de otro cliente
- **THEN** recibe 200

#### Scenario: Unión de PEDIDOS y STOCK
- **WHEN** un usuario con los roles `PEDIDOS` y `STOCK` consulta el pago de un pedido de otro cliente
- **THEN** recibe 403
