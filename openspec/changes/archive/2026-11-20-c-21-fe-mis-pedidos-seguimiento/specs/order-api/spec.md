# Spec Delta — order-api

## MODIFIED Requirements

### Requirement: Filtros del listado de pedidos
`GET /api/v1/pedidos` SHALL aceptar los filtros opcionales `estado` (uno de los seis códigos de estado; otro valor responde 422), `desde` y `hasta` (fechas `YYYY-MM-DD`, inclusivas, sobre la fecha de creación) y `propios` (booleano, por defecto `false`; con `true` el listado se limita a los pedidos del usuario aunque sus roles le den alcance sobre todos). Los filtros SHALL combinarse con el alcance del lector y nunca ampliarlo; `total` SHALL contar solo lo filtrado.

#### Scenario: Filtro por estado
- **WHEN** existen 2 pedidos `PENDIENTE` y 1 `CONFIRMADO`, y un `ADMIN` llama a `GET /api/v1/pedidos?estado=PENDIENTE`
- **THEN** recibe `total` 2 y todos los `items` tienen `estado_codigo` `PENDIENTE`

#### Scenario: Filtro por rango de fechas
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?desde=2026-11-01&hasta=2026-11-01` y hay un pedido creado ese día y otro el día siguiente
- **THEN** recibe solo el pedido creado el 2026-11-01

#### Scenario: Estado desconocido
- **WHEN** un `ADMIN` llama a `GET /api/v1/pedidos?estado=DESPACHADO`
- **THEN** recibe 422 con `field` `estado`

#### Scenario: Solo los propios para un gestor
- **WHEN** existen 2 pedidos del usuario U (roles `CLIENT` y `PEDIDOS`) y 3 del cliente B, y U llama a `GET /api/v1/pedidos?propios=true`
- **THEN** recibe `total` 2 y solo pedidos de U

#### Scenario: Propios para un cliente
- **WHEN** el cliente A llama a `GET /api/v1/pedidos?propios=true`
- **THEN** recibe lo mismo que sin el filtro: solo sus pedidos

#### Scenario: Propios combinado con estado
- **WHEN** un usuario con los roles `CLIENT` y `ADMIN`, con 1 pedido propio `PENDIENTE` y 1 propio `ENTREGADO` llama a `GET /api/v1/pedidos?propios=true&estado=PENDIENTE`
- **THEN** recibe `total` 1
