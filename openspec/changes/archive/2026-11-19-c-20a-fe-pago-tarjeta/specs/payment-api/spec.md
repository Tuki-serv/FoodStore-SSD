# Spec Delta — payment-api

## ADDED Requirements

### Requirement: Configuración pública de pagos
`GET /api/v1/pagos/config` SHALL devolver 200 con un cuerpo que tenga exactamente el campo `public_key`, con la clave **pública** de MercadoPago configurada en el backend (`MP_PUBLIC_KEY`), para que el frontend inicialice el brick `CardPayment`. La respuesta nunca SHALL incluir el access token ni el secreto del webhook, y la ruta `config` no SHALL interpretarse como un `pedido_id`.

#### Scenario: Clave pública configurada
- **WHEN** `MP_PUBLIC_KEY` vale `APP_USR-clave-publica-de-prueba` y un cliente autenticado llama a `GET /api/v1/pagos/config`
- **THEN** recibe 200 con el cuerpo `{"public_key": "APP_USR-clave-publica-de-prueba"}` y ningún otro campo

#### Scenario: Sin secretos en la respuesta
- **WHEN** `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y `MP_PUBLIC_KEY` están definidas y un cliente autenticado llama a `GET /api/v1/pagos/config`
- **THEN** el cuerpo no contiene el valor de `MP_ACCESS_TOKEN` ni el de `MP_WEBHOOK_SECRET`

#### Scenario: La ruta no es un pedido
- **WHEN** un cliente autenticado llama a `GET /api/v1/pagos/config` con la clave configurada
- **THEN** no recibe 422 por `pedido_id` ni la respuesta de la consulta de un pago

### Requirement: La configuración de pagos exige autenticación
`GET /api/v1/pagos/config` SHALL exigir un access token Bearer válido de un usuario activo, sin restricción de rol. Sin token, o con un token inválido, vencido o revocado, SHALL responder 401 con `code` `HTTP_401` en el formato de error de la API.

#### Scenario: Cualquier rol autenticado
- **WHEN** un usuario activo con rol `ADMIN` (sin `CLIENT`) llama a `GET /api/v1/pagos/config` con la clave configurada
- **THEN** recibe 200 con `public_key`

#### Scenario: Sin token
- **WHEN** un cliente anónimo llama a `GET /api/v1/pagos/config`
- **THEN** recibe 401 con `code` `HTTP_401` y el cuerpo no incluye `public_key`

### Requirement: Configuración de pagos sin clave pública
Si `MP_PUBLIC_KEY` no está definida, está vacía o solo tiene espacios, `GET /api/v1/pagos/config` SHALL responder 503 con `code` `HTTP_503` en el formato de error de la API.

#### Scenario: Clave pública sin configurar
- **WHEN** `MP_PUBLIC_KEY` no está definida, o vale `"  "`, y un cliente autenticado llama a `GET /api/v1/pagos/config`
- **THEN** recibe 503 con `code` `HTTP_503`
