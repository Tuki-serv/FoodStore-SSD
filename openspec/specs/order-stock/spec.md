# order-stock Specification

## Purpose
Define cuándo el stock de los productos cambia por un pedido: se verifica al crearlo, se descuenta al confirmarlo y se devuelve solo al cancelar un pedido ya confirmado, sin quedar nunca negativo aunque haya pedidos concurrentes.

## Requirements

### Requirement: Crear un pedido verifica el stock sin descontarlo
`POST /api/v1/pedidos` SHALL rechazar con 400 y un mensaje claro un pedido con un producto no disponible o sin stock suficiente, sumando las cantidades de todas las líneas del mismo producto. Un pedido aceptado SHALL quedar en `PENDIENTE` sin modificar el `stock_cantidad` de ningún producto.

#### Scenario: Crear no descuenta
- **WHEN** un `CLIENT` crea un pedido de 2 unidades de un producto con stock 5
- **THEN** recibe 201, el pedido queda en `PENDIENTE` y el stock releído del producto sigue en 5

#### Scenario: Líneas del mismo producto que suman más que el stock
- **WHEN** un `CLIENT` crea un pedido con dos líneas del mismo producto (distinta personalización) de 3 unidades cada una y el producto tiene stock 5
- **THEN** recibe 400 con un mensaje de stock insuficiente, no se crea el pedido y el stock sigue en 5

#### Scenario: Producto no disponible
- **WHEN** un `CLIENT` crea un pedido con un producto `disponible = false` que tiene stock
- **THEN** recibe 400 con un mensaje de producto no disponible y no se crea el pedido

### Requirement: Confirmar un pedido descuenta el stock en la misma transacción
Toda transición a `CONFIRMADO`, manual o automática, SHALL descontar la cantidad de cada línea del pedido del stock de su producto dentro de la misma transacción que cambia el estado y escribe el historial. Si alguna línea no alcanza, no SHALL descontarse ninguna.

#### Scenario: Confirmación manual descuenta
- **WHEN** un usuario `PEDIDOS` confirma un pedido `EFECTIVO` en `PENDIENTE` de 2 unidades de un producto con stock 5
- **THEN** recibe 200, el pedido queda en `CONFIRMADO` y el stock releído es 3

#### Scenario: Confirmación automática descuenta
- **WHEN** el webhook procesa un pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` de 2 unidades de un producto con stock 5
- **THEN** responde 200, el pedido queda en `CONFIRMADO` y el stock releído es 3

#### Scenario: Pedido con varios productos
- **WHEN** se confirma un pedido con 1 unidad del producto A (stock 4) y 3 del producto B (stock 3)
- **THEN** el stock releído de A es 3 y el de B es 0

### Requirement: Confirmación manual sin stock suficiente se rechaza
Si al confirmar a mano un pedido alguna línea supera el stock actual de su producto, la transición SHALL responder 409 con un `detail` que nombra el producto sin stock; el pedido SHALL seguir en `PENDIENTE`, el historial no SHALL sumar filas y ningún stock SHALL cambiar.

#### Scenario: El stock se agotó después de crear el pedido
- **WHEN** un usuario `ADMIN` confirma un pedido `TRANSFERENCIA` de 2 unidades de un producto cuyo stock bajó a 1 después de crear el pedido
- **THEN** recibe 409 con un `detail` que incluye el nombre del producto, el pedido sigue en `PENDIENTE`, el historial no tiene fila hacia `CONFIRMADO` y el stock sigue en 1

#### Scenario: Una línea alcanza y otra no
- **WHEN** un usuario `PEDIDOS` confirma un pedido con 1 unidad de A (stock 5) y 2 de B (stock 1)
- **THEN** recibe 409, el pedido sigue en `PENDIENTE` y los stocks siguen en 5 y 1

### Requirement: Pago aprobado sin stock cancela el pedido como Sistema
Si el webhook procesa un pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` y alguna línea supera el stock actual, el pedido SHALL pasar a `CANCELADO` con motivo «Sin stock» y una fila de historial con `usuario_id` nulo; ningún stock SHALL cambiar; el pago SHALL quedar con estado local `a_devolver` para devolución manual; y el webhook SHALL responder 200.

#### Scenario: Dos pedidos pagan la última unidad
- **WHEN** dos pedidos `MERCADOPAGO` en `PENDIENTE` piden la única unidad de un producto y el webhook procesa los dos pagos aprobados, uno después del otro
- **THEN** el primero queda en `CONFIRMADO`; el segundo queda en `CANCELADO` con una fila de historial `PENDIENTE → CANCELADO`, motivo «Sin stock» y `usuario_id` nulo; su pago queda `a_devolver`; las dos respuestas son 200; y el stock releído es 0

#### Scenario: El estado del pago se consulta como a devolver
- **WHEN** después de ese caso se consulta `GET /api/v1/pagos/{pedido_id}` del pedido cancelado
- **THEN** la respuesta tiene `estado` igual a `a_devolver`

#### Scenario: Reenvío de la notificación
- **WHEN** MercadoPago reenvía la notificación del pago que quedó `a_devolver`
- **THEN** la respuesta es 200, el pedido sigue en `CANCELADO`, el stock no cambia y el historial no suma filas

### Requirement: Cancelar devuelve el stock solo si el pedido ya lo había descontado
Cancelar un pedido en `PENDIENTE` no SHALL modificar el stock. Cancelar un pedido en `CONFIRMADO` o `EN_PREP` SHALL sumar al stock de cada producto la cantidad de su línea, en la misma transacción de la transición. Un producto eliminado (soft delete) SHALL quedar sin cambios.

#### Scenario: Cancelar un pendiente
- **WHEN** el dueño `CLIENT` cancela con motivo su pedido en `PENDIENTE` de 2 unidades de un producto con stock 5
- **THEN** recibe 200, el pedido queda en `CANCELADO` y el stock sigue en 5

#### Scenario: Cancelar un confirmado
- **WHEN** el dueño `CLIENT` cancela con motivo su pedido `CONFIRMADO` de 2 unidades de un producto que quedó con stock 3 tras la confirmación
- **THEN** recibe 200 y el stock releído es 5

#### Scenario: Cancelar en preparación
- **WHEN** un usuario `PEDIDOS` cancela con motivo un pedido en `EN_PREP` de 1 unidad de un producto con stock 0
- **THEN** recibe 200 y el stock releído es 1

### Requirement: Confirmaciones concurrentes no venden de más
Dos confirmaciones simultáneas que compiten por el mismo stock SHALL serializarse: el stock nunca SHALL quedar negativo ni descontarse dos veces la misma unidad, y dos pedidos que comparten productos SHALL confirmarse sin bloquearse mutuamente.

#### Scenario: Dos confirmaciones manuales sobre la última unidad
- **WHEN** dos usuarios `PEDIDOS` confirman al mismo tiempo dos pedidos `EFECTIVO` en `PENDIENTE`, de 1 unidad cada uno, de un producto con stock 1
- **THEN** exactamente uno recibe 200 y queda `CONFIRMADO`, el otro recibe 409 y sigue `PENDIENTE`, y el stock releído es 0

#### Scenario: Pedidos con los mismos productos en distinto orden
- **WHEN** se confirman al mismo tiempo un pedido con líneas (A, B) y otro con líneas (B, A), con stock suficiente para ambos
- **THEN** los dos reciben 200 y los stocks de A y B bajan en la suma de ambas cantidades
