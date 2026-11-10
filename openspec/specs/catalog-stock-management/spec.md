# catalog-stock-management Specification

## Purpose

Define la edición manual del inventario de un producto: fijar su disponibilidad y su cantidad en stock con contratos idempotentes y validados, accesibles a ADMIN y STOCK, sin dar escritura sobre el resto del producto.

## Requirements

### Requirement: Fijar la disponibilidad de un producto
`PATCH /api/v1/productos/{id}/disponibilidad` SHALL recibir el body `{"disponible": <bool>}`, fijar ese valor en el producto y responder 200 con el producto completo. La operación SHALL ser idempotente: repetirla con el mismo valor deja el mismo resultado. No SHALL modificar ningún otro campo del producto.

#### Scenario: Marcar un producto como no disponible
- **WHEN** un usuario `STOCK` envía `{"disponible": false}` para un producto disponible
- **THEN** recibe 200 con `disponible` igual a `false`, y `nombre`, `precio_base` y `stock_cantidad` no cambian

#### Scenario: Repetir el mismo valor
- **WHEN** un usuario `STOCK` envía `{"disponible": false}` dos veces seguidas para el mismo producto
- **THEN** las dos respuestas son 200 con `disponible` igual a `false`

#### Scenario: Volver a habilitar
- **WHEN** un usuario `ADMIN` envía `{"disponible": true}` para un producto no disponible
- **THEN** recibe 200 con `disponible` igual a `true`

#### Scenario: Body ausente
- **WHEN** un usuario `STOCK` llama al endpoint sin body
- **THEN** recibe 422 y `disponible` no cambia

### Requirement: Fijar el stock de un producto
`PATCH /api/v1/productos/{id}/stock` SHALL recibir el body `{"stock_cantidad": <int>}`, fijar ese valor absoluto y responder 200 con el producto completo. La operación SHALL ser idempotente. Un valor negativo, ausente o no entero, o cualquier campo adicional en el body, SHALL responder 422 sin modificar el producto.

#### Scenario: Fijar una cantidad
- **WHEN** un usuario `STOCK` envía `{"stock_cantidad": 7}` para un producto con stock 10
- **THEN** recibe 200 con `stock_cantidad` igual a 7, y al releer el producto el stock es 7

#### Scenario: Repetir la misma cantidad
- **WHEN** un usuario `STOCK` envía `{"stock_cantidad": 7}` dos veces seguidas
- **THEN** las dos respuestas son 200 con `stock_cantidad` igual a 7

#### Scenario: Cantidad negativa
- **WHEN** un usuario `STOCK` envía `{"stock_cantidad": -1}`
- **THEN** recibe 422 y el stock no cambia

#### Scenario: Campos fuera del contrato
- **WHEN** un usuario `STOCK` envía `{"stock_cantidad": 3, "precio_base": 1}`
- **THEN** recibe 422, y ni el stock ni el precio cambian

### Requirement: Stock y disponibilidad son independientes
Fijar `stock_cantidad` no SHALL cambiar `disponible`, y fijar `disponible` no SHALL cambiar `stock_cantidad`, incluido el caso de stock 0 (RN-PR-02).

#### Scenario: Stock en cero no deshabilita el producto
- **WHEN** un usuario `STOCK` fija `{"stock_cantidad": 0}` en un producto disponible
- **THEN** recibe 200 con `stock_cantidad` igual a 0 y `disponible` igual a `true`

#### Scenario: Deshabilitar no toca el stock
- **WHEN** un usuario `STOCK` fija `{"disponible": false}` en un producto con stock 12
- **THEN** recibe 200 con `disponible` igual a `false` y `stock_cantidad` igual a 12

### Requirement: Solo productos existentes y no eliminados
Fijar el stock o la disponibilidad de un producto inexistente o eliminado (soft delete) SHALL responder 404 sin modificar nada.

#### Scenario: Producto eliminado
- **WHEN** un usuario `STOCK` fija `{"stock_cantidad": 4}` o `{"disponible": true}` en un producto con `deleted_at` definido
- **THEN** recibe 404 y el producto no cambia

#### Scenario: Producto inexistente
- **WHEN** un usuario `ADMIN` fija `{"stock_cantidad": 4}` en un id que no existe
- **THEN** recibe 404

### Requirement: Quién edita el inventario
Fijar el stock y la disponibilidad SHALL estar permitido a los roles `ADMIN` y `STOCK`. Cualquier otro usuario autenticado SHALL recibir 403 y un pedido sin access SHALL recibir 401, en ambos casos sin modificar el producto.

#### Scenario: Rol sin permiso
- **WHEN** un usuario con solo el rol `CLIENT` o solo el rol `PEDIDOS` envía `{"stock_cantidad": 1}`
- **THEN** recibe 403 y el stock no cambia

#### Scenario: Sin autenticación
- **WHEN** un pedido sin header `Authorization` envía `{"disponible": false}`
- **THEN** recibe 401 y `disponible` no cambia
