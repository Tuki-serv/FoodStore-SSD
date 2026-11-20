# Spec Delta — sales-metrics

## Purpose

Define la API de estadísticas de ventas que alimenta el dashboard del `ADMIN` (US-028): qué cuenta como venta, el resumen de KPIs, la serie por período, el ranking de productos, los pedidos por estado y los ingresos por forma de pago, con un rango de fechas validado.

## ADDED Requirements

### Requirement: Definición de venta
Un pedido SHALL contar como venta cuando su estado actual es `CONFIRMADO`, `EN_PREP`, `EN_CAMINO` o `ENTREGADO`, cualquiera sea su forma de pago. Los pedidos `PENDIENTE` y `CANCELADO` no SHALL contar como venta. El importe de una venta SHALL ser el `total` del pedido.

#### Scenario: Venta en efectivo confirmada a mano
- **WHEN** existe un pedido `EFECTIVO` de total 1500 en `CONFIRMADO`, sin ningún pago registrado, y un `ADMIN` pide el resumen del día de su creación
- **THEN** `ventas` es 1 e `ingresos` es "1500.00"

#### Scenario: Pendiente y cancelado no cuentan
- **WHEN** en el rango hay un pedido `PENDIENTE` de total 1000 y uno `CANCELADO` de total 2000, y ninguno más
- **THEN** el resumen devuelve `ventas` 0 e `ingresos` "0.00"

#### Scenario: Pedido MERCADOPAGO aprobado
- **WHEN** un pedido `MERCADOPAGO` de total 800 quedó `CONFIRMADO` por un pago aprobado
- **THEN** cuenta como una venta de "800.00"

### Requirement: Rango de fechas de los reportes
Todos los reportes SHALL exigir `desde` y `hasta` (fechas `YYYY-MM-DD`, inclusivas) y filtrar por la fecha de creación del pedido en UTC. Si `desde` es posterior a `hasta` SHALL responder 422 `VALIDATION_ERROR` con `field` `desde`; si el rango supera 366 días, 422 con `field` `hasta`. Los reportes no SHALL aceptar `page` ni `size`.

#### Scenario: Borde del día en UTC
- **WHEN** existe una venta creada el 2026-11-10 a las 01:30 UTC y un `ADMIN` pide ventas del 2026-11-10 al 2026-11-10
- **THEN** la venta se cuenta en el 2026-11-10

#### Scenario: Rango invertido
- **WHEN** un `ADMIN` llama a `GET /api/v1/estadisticas/resumen?desde=2026-11-20&hasta=2026-11-01`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `desde`

#### Scenario: Rango demasiado largo
- **WHEN** un `ADMIN` llama a `GET /api/v1/estadisticas/ventas?desde=2025-01-01&hasta=2026-11-20`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `hasta`

#### Scenario: Fecha faltante
- **WHEN** un `ADMIN` llama a `GET /api/v1/estadisticas/ingresos?desde=2026-11-01`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `hasta`

### Requirement: Resumen de KPIs
`GET /api/v1/estadisticas/resumen` SHALL responder `{ventas, ingresos, ticket_promedio, pedidos_activos}`: cantidad de ventas e ingresos del rango, `ticket_promedio` = ingresos / ventas redondeado a 2 decimales ("0.00" sin ventas) y `pedidos_activos` = pedidos que **ahora** están en `CONFIRMADO`, `EN_PREP` o `EN_CAMINO`, sin importar el rango. Los importes SHALL viajar como texto decimal con 2 decimales.

#### Scenario: Ticket promedio
- **WHEN** en el rango hay ventas de 1000, 1500 y 2000
- **THEN** el resumen devuelve `ventas` 3, `ingresos` "4500.00" y `ticket_promedio` "1500.00"

#### Scenario: Pedidos activos fuera del rango
- **WHEN** hay un pedido `EN_PREP` creado ayer, uno `PENDIENTE` y uno `ENTREGADO` creados hoy, y el `ADMIN` pide el resumen de hoy
- **THEN** `pedidos_activos` es 1

#### Scenario: Sin ventas
- **WHEN** el rango no tiene ventas
- **THEN** el resumen devuelve `ventas` 0, `ingresos` "0.00" y `ticket_promedio` "0.00"

### Requirement: Ventas por período
`GET /api/v1/estadisticas/ventas` SHALL aceptar `agrupacion` `day`, `week` (semana ISO, desde el lunes) o `month` (por defecto `day`) y responder una lista ordenada `[{fecha, total_ventas, cantidad_pedidos}]` con un elemento por cada período que toca el rango, donde `fecha` es el inicio del período; un período sin ventas SHALL aparecer con 0. Otra `agrupacion` SHALL responder 422 `VALIDATION_ERROR` con `field` `agrupacion`.

#### Scenario: Días sin ventas rellenados
- **WHEN** hay una venta de 1000 el 2026-11-10 y el `ADMIN` pide del 2026-11-09 al 2026-11-11 por día
- **THEN** recibe tres elementos: 2026-11-09 con 0, 2026-11-10 con `total_ventas` "1000.00" y `cantidad_pedidos` 1, y 2026-11-11 con 0

#### Scenario: Agrupación mensual
- **WHEN** hay ventas el 2026-10-31 y el 2026-11-02 y el `ADMIN` pide del 2026-10-15 al 2026-11-15 por mes
- **THEN** recibe dos elementos con `fecha` 2026-10-01 y 2026-11-01, cada uno con una venta

#### Scenario: Agrupación inválida
- **WHEN** un `ADMIN` llama a `GET /api/v1/estadisticas/ventas?desde=2026-11-01&hasta=2026-11-20&agrupacion=year`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `agrupacion`

### Requirement: Productos más vendidos
`GET /api/v1/estadisticas/productos-top` SHALL responder `[{producto_id, nombre, cantidad_vendida, ingresos}]` de los productos de las ventas del rango, agrupados por producto (no por nombre), ordenados por `cantidad_vendida` descendente, luego `ingresos` descendente y luego `producto_id`. `limit` SHALL ir de 1 a 20 (por defecto 5); fuera de rango, 422 con `field` `limit`.

#### Scenario: Orden por cantidad
- **WHEN** en el rango se vendieron 5 «Pizza» por 5000 y 8 «Empanada» por 2400
- **THEN** el primer elemento es «Empanada» con `cantidad_vendida` 8 y el segundo «Pizza»

#### Scenario: Productos homónimos
- **WHEN** dos productos distintos se llaman «Tarta» y se vendió uno de cada uno
- **THEN** la respuesta tiene dos elementos «Tarta» con `producto_id` distintos

#### Scenario: Límite fuera de rango
- **WHEN** un `ADMIN` pide `limit=21`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `limit`

#### Scenario: Pedido cancelado excluido
- **WHEN** el único pedido del rango con «Pizza» está `CANCELADO`
- **THEN** «Pizza» no aparece en el ranking

### Requirement: Pedidos por estado
`GET /api/v1/estadisticas/pedidos-por-estado` SHALL responder los seis estados del pedido en el orden de la FSM (`PENDIENTE`, `CONFIRMADO`, `EN_PREP`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO`) como `[{estado_codigo, cantidad}]`, contando todos los pedidos creados en el rango según su estado actual, con 0 los estados sin pedidos.

#### Scenario: Incluye cancelados y ceros
- **WHEN** en el rango hay dos pedidos `PENDIENTE` y uno `CANCELADO`
- **THEN** recibe seis elementos: `PENDIENTE` 2, `CANCELADO` 1 y los otros cuatro con 0

### Requirement: Ingresos por forma de pago
`GET /api/v1/estadisticas/ingresos` SHALL responder una entrada `{forma_pago_codigo, total, cantidad}` por cada forma de pago del catálogo con los ingresos y la cantidad de ventas del rango, ordenadas por `total` descendente y luego por código; una forma sin ventas SHALL aparecer con "0.00" y 0.

#### Scenario: Efectivo y Mercado Pago
- **WHEN** en el rango hay una venta `EFECTIVO` de 1500 y dos `MERCADOPAGO` de 500 cada una
- **THEN** recibe `EFECTIVO` "1500.00"/1, `MERCADOPAGO` "1000.00"/2 y `TRANSFERENCIA` "0.00"/0, en ese orden

### Requirement: Reportes solo para ADMIN
Los cinco reportes de `/api/v1/estadisticas/` SHALL requerir un usuario autenticado con el rol `ADMIN`: sin sesión, 401; con sesión sin `ADMIN`, 403, ambos en el formato `{detail, code, field}`. La autorización SHALL resolverse antes que la validación de los parámetros.

#### Scenario: Gestor de pedidos
- **WHEN** un usuario con roles `CLIENT` y `PEDIDOS` llama a `GET /api/v1/estadisticas/ventas?desde=2026-11-01&hasta=2026-11-20`
- **THEN** recibe 403 con `code` `HTTP_403`

#### Scenario: Sin sesión y sin parámetros
- **WHEN** un cliente sin `Authorization` llama a `GET /api/v1/estadisticas/resumen`
- **THEN** recibe 401 con `code` `HTTP_401`
