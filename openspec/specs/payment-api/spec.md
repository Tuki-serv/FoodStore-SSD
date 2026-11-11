# payment-api Specification

## Purpose
Define la superficie HTTP de pagos con MercadoPago: quién puede crear y consultar el pago de un pedido, con qué códigos se rechaza a quien no puede y qué rutas de pagos son públicas. El flujo de cobro y el procesamiento del webhook los definen sus propios changes (C-05, C-12).

## Requirements

### Requirement: Crear y consultar un pago exige autenticación
`POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}` SHALL exigir un access token Bearer válido de un usuario activo. Sin header `Authorization`, o con un token inválido, vencido o revocado, SHALL responder 401 en el formato de error de la API (`code` `HTTP_401`) sin crear ningún pago ni contactar a MercadoPago.

#### Scenario: Crear pago sin token
- **WHEN** un cliente anónimo llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido existente
- **THEN** recibe 401 con `code` `HTTP_401`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

#### Scenario: Consultar pago sin token
- **WHEN** un cliente anónimo llama a `GET /api/v1/pagos/{pedido_id}` de un pedido existente
- **THEN** recibe 401 con `code` `HTTP_401` y el cuerpo no incluye el estado del pago

#### Scenario: Token inválido
- **WHEN** se llama a `GET /api/v1/pagos/{pedido_id}` con `Authorization: Bearer x.y.z`
- **THEN** recibe 401

### Requirement: Solo el propietario del pedido o ADMIN operan su pago
Crear o consultar el pago de un pedido SHALL estar permitido al usuario dueño del pedido y a cualquier usuario cuyos roles (leídos de la base en cada request, unión de roles) incluyan `ADMIN`. Cualquier otro usuario autenticado SHALL recibir 403 con `code` `HTTP_403`, sin datos del pedido ni del pago, sin crear pagos y sin contactar a MercadoPago.

#### Scenario: Propietario crea el pago de su pedido
- **WHEN** el cliente A, con MercadoPago configurado, llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido
- **THEN** recibe 201 con `pago_id`, `preference_id` e `init_point`, y queda un pago `pendiente` asociado al pedido

#### Scenario: Propietario consulta el pago de su pedido
- **WHEN** el cliente A llama a `GET /api/v1/pagos/{pedido_id}` de su pedido que tiene un pago `pendiente`
- **THEN** recibe 200 con `pedido_id` y `estado` `pendiente`

#### Scenario: Otro cliente intenta crear el pago
- **WHEN** el cliente B llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido de A
- **THEN** recibe 403 con `code` `HTTP_403`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

#### Scenario: Otro cliente intenta consultar el pago
- **WHEN** el cliente B llama a `GET /api/v1/pagos/{pedido_id}` de un pedido de A
- **THEN** recibe 403 con `code` `HTTP_403` y el cuerpo no incluye `estado`

#### Scenario: ADMIN consulta el pago de cualquier pedido
- **WHEN** un usuario con el rol `ADMIN` llama a `GET /api/v1/pagos/{pedido_id}` de un pedido de A
- **THEN** recibe 200 con el estado del último pago del pedido

#### Scenario: ADMIN crea el pago de un pedido ajeno
- **WHEN** un usuario con el rol `ADMIN`, con MercadoPago configurado, llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido de A
- **THEN** recibe 201 y el pago queda asociado al pedido de A

#### Scenario: PEDIDOS y STOCK no operan pagos ajenos
- **WHEN** un usuario con solo el rol `PEDIDOS`, o solo el rol `STOCK`, llama a `GET /api/v1/pagos/{pedido_id}` o a `POST /api/v1/pagos/crear` de un pedido de A
- **THEN** cada request responde 403

#### Scenario: Rol ADMIN quitado
- **WHEN** a un usuario se le quita el rol `ADMIN` en la base y, con el mismo access token, llama a `GET /api/v1/pagos/{pedido_id}` de un pedido ajeno
- **THEN** recibe 403

### Requirement: Pedido inexistente en pagos
Si el `pedido_id` no corresponde a un pedido o el pedido está eliminado lógicamente, crear o consultar su pago SHALL responder 404 con `code` `HTTP_404` a cualquier usuario autenticado, sin contactar a MercadoPago.

#### Scenario: Crear pago de un pedido inexistente
- **WHEN** un cliente autenticado llama a `POST /api/v1/pagos/crear` con `pedido_id` 999999
- **THEN** recibe 404 con `code` `HTTP_404`

#### Scenario: Consultar pago de un pedido inexistente
- **WHEN** un usuario `ADMIN` llama a `GET /api/v1/pagos/999999`
- **THEN** recibe 404 con `code` `HTTP_404` (ya no 200 con `estado` nulo)

#### Scenario: Pedido propio sin pagos
- **WHEN** el cliente A llama a `GET /api/v1/pagos/{pedido_id}` de un pedido suyo que todavía no tiene pagos
- **THEN** recibe 200 con `pedido_id` y `estado` nulo

### Requirement: Orden de las verificaciones de un pago
Al crear o consultar un pago, las verificaciones SHALL aplicarse en este orden: autenticación (401), existencia del pedido (404), acceso al pedido (403) y recién después la configuración de MercadoPago (503) y la llamada a MercadoPago. Un usuario sin acceso nunca SHALL recibir un 503 ni provocar una llamada a MercadoPago.

#### Scenario: Otro cliente sin MercadoPago configurado
- **WHEN** `MP_ACCESS_TOKEN` no está definida y el cliente B llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido de A
- **THEN** recibe 403 (no 503)

#### Scenario: Anónimo con pedido inexistente
- **WHEN** un cliente anónimo llama a `POST /api/v1/pagos/crear` con `pedido_id` 999999
- **THEN** recibe 401 (no 404)

### Requirement: Rutas públicas de pagos
`POST /api/v1/pagos/webhook` SHALL seguir siendo público (lo invoca MercadoPago sin token de usuario). `GET /api/v1/pagos/redirect/{pedido_id}/{status}` SHALL seguir siendo público mientras exista el flujo Checkout Pro, porque lo abre el navegador al volver de MercadoPago, y no SHALL exponer datos del pedido ni del pago.

#### Scenario: Webhook sin token
- **WHEN** MercadoPago envía `POST /api/v1/pagos/webhook` con un tópico no soportado y sin header `Authorization`
- **THEN** recibe 200 con `status` `ignored` (no 401)

#### Scenario: Redirect sin token
- **WHEN** el navegador abre `GET /api/v1/pagos/redirect/{pedido_id}/success` sin header `Authorization` y `FRONTEND_URL` está definida
- **THEN** recibe una redirección al frontend (no 401)
