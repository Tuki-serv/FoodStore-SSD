## MODIFIED Requirements

### Requirement: Solo el propietario del pedido o ADMIN operan su pago
Crear o consultar el pago de un pedido SHALL estar permitido al usuario dueño del pedido y a cualquier usuario cuyos roles (leídos de la base en cada request, unión de roles) incluyan `ADMIN`. Cualquier otro usuario autenticado SHALL recibir 403 con `code` `HTTP_403`, sin datos del pedido ni del pago, sin crear pagos y sin contactar a MercadoPago.

#### Scenario: Propietario crea el pago de su pedido
- **WHEN** el cliente A, con MercadoPago configurado, llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido `MERCADOPAGO` en `PENDIENTE` y un token de tarjeta que MercadoPago aprueba
- **THEN** recibe 201 con `pago_id`, `pedido_id`, `estado` `aprobado`, `mp_payment_id`, `mp_status` `approved` y `mp_status_detail`, y el cuerpo no tiene `preference_id`, `init_point` ni `public_key`

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
- **WHEN** un usuario con el rol `ADMIN`, con MercadoPago configurado, llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido `MERCADOPAGO` en `PENDIENTE` de A y un token de tarjeta válido
- **THEN** recibe 201 y el pago queda asociado al pedido de A

#### Scenario: PEDIDOS y STOCK no operan pagos ajenos
- **WHEN** un usuario con solo el rol `PEDIDOS`, o solo el rol `STOCK`, llama a `GET /api/v1/pagos/{pedido_id}` o a `POST /api/v1/pagos/crear` de un pedido de A
- **THEN** cada request responde 403

#### Scenario: Rol ADMIN quitado
- **WHEN** a un usuario se le quita el rol `ADMIN` en la base y, con el mismo access token, llama a `GET /api/v1/pagos/{pedido_id}` de un pedido ajeno
- **THEN** recibe 403

### Requirement: Orden de las verificaciones de un pago
Al crear o consultar un pago, las verificaciones SHALL aplicarse en este orden: autenticación (401), existencia del pedido (404), acceso al pedido (403), al crear las precondiciones de cobro (409 `PAYMENT_NOT_ALLOWED`) y recién después la configuración de MercadoPago (503) y la llamada a MercadoPago. Un usuario sin acceso nunca SHALL recibir un 409 ni un 503 ni provocar una llamada a MercadoPago.

#### Scenario: Otro cliente sin MercadoPago configurado
- **WHEN** `MP_ACCESS_TOKEN` no está definida y el cliente B llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido de A
- **THEN** recibe 403 (no 503)

#### Scenario: Anónimo con pedido inexistente
- **WHEN** un cliente anónimo llama a `POST /api/v1/pagos/crear` con `pedido_id` 999999
- **THEN** recibe 401 (no 404)

#### Scenario: Otro cliente sobre un pedido ya pagado
- **WHEN** el cliente B llama a `POST /api/v1/pagos/crear` con el `pedido_id` de un pedido de A que ya tiene un pago `aprobado`
- **THEN** recibe 403 (no 409)

#### Scenario: Precondición antes que la configuración
- **WHEN** `MP_ACCESS_TOKEN` no está definida y el cliente A llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido `EFECTIVO`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` (no 503)

### Requirement: Rutas públicas de pagos
`POST /api/v1/pagos/webhook` SHALL seguir siendo público respecto del usuario: no exige token Bearer (lo invoca MercadoPago), pero SHALL exigir la firma de MercadoPago (ver «El webhook exige la firma de MercadoPago»). Es la única ruta pública de pagos: no SHALL existir una ruta de retorno desde MercadoPago (`/api/v1/pagos/redirect/...`), porque el cobro ocurre dentro del sitio.

#### Scenario: Webhook sin token
- **WHEN** MercadoPago envía `POST /api/v1/pagos/webhook` con un tópico no soportado, firma válida y sin header `Authorization`
- **THEN** recibe 200 con `status` `ignored` (no 401)

#### Scenario: Webhook sin token ni firma
- **WHEN** se envía `POST /api/v1/pagos/webhook` sin header `Authorization` ni `x-signature`, con `MP_WEBHOOK_SECRET` definida
- **THEN** recibe 401 por la firma

#### Scenario: Redirect sin token
- **WHEN** el navegador abre `GET /api/v1/pagos/redirect/{pedido_id}/success` sin header `Authorization` (ruta de Checkout Pro, retirada)
- **THEN** recibe 404 con `code` `HTTP_404` en el formato de error de la API y no hay redirección

## ADDED Requirements

### Requirement: Crear un pago con token de tarjeta
`POST /api/v1/pagos/crear` SHALL recibir `pedido_id`, `token`, `payment_method_id`, `installments` (entero ≥ 1), `issuer_id` opcional y `payer` con `email` e `identification` opcional, y SHALL crear el pago en MercadoPago por el total del pedido, con 2 decimales, en ARS. Un cuerpo inválido SHALL responder 422 `VALIDATION_ERROR` sin contactar a MercadoPago.

#### Scenario: Cobro con los datos del brick
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `pedido_id` de su pedido `MERCADOPAGO` en `PENDIENTE` de total `1500.50`, `token` `tok-1`, `payment_method_id` `visa`, `installments` 1, `issuer_id` `310` y `payer.email` `a@test.com`
- **THEN** MercadoPago recibe un pago con `transaction_amount` 1500.5, `token` `tok-1`, `payment_method_id` `visa`, `installments` 1, `issuer_id` 310 y `payer.email` `a@test.com`

#### Scenario: Falta el token
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `pedido_id` de su pedido y sin `token`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `token`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

#### Scenario: Cuotas inválidas
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `installments` 0
- **THEN** recibe 422 con `field` `installments`

### Requirement: Los datos de la tarjeta nunca llegan al backend
El backend SHALL aceptar solo el token de la tarjeta generado en el navegador. Un cuerpo de `POST /api/v1/pagos/crear` con campos fuera del contrato (por ejemplo número, código de seguridad o vencimiento de la tarjeta) SHALL responder 422 sin contactar a MercadoPago, y ningún dato de tarjeta SHALL guardarse ni registrarse en el log.

#### Scenario: Número de tarjeta en el cuerpo
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con un cuerpo válido más `card_number` `4509953566233704`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

### Requirement: Cada intento de pago tiene claves propias
Cada intento de pago SHALL tener un `idempotency_key` y una `external_reference` UUID únicos y obligatorios, generados por el backend. El intento SHALL guardarse como `pendiente` antes de contactar a MercadoPago, y la creación SHALL enviarse con el header `X-Idempotency-Key` igual a su `idempotency_key` y con `external_reference` igual a la suya.

#### Scenario: Claves enviadas a MercadoPago
- **WHEN** el cliente A crea el pago de su pedido y MercadoPago lo aprueba
- **THEN** la fila de `pagos` tiene `idempotency_key` y `external_reference` con formato UUID, la llamada a MercadoPago llevó `X-Idempotency-Key` igual a ese `idempotency_key` y `external_reference` igual a esa referencia

#### Scenario: Intentos distintos, claves distintas
- **WHEN** el cliente A crea un pago que MercadoPago rechaza y luego otro que MercadoPago aprueba
- **THEN** el pedido tiene dos filas en `pagos` con `idempotency_key` distintos y `external_reference` distintas

### Requirement: Precondiciones para cobrar un pedido
Crear un pago SHALL exigir que el pedido sea `MERCADOPAGO`, esté en `PENDIENTE` y no tenga un pago `aprobado` o `a_devolver` ni un pago en proceso en MercadoPago (`pendiente` con id de MercadoPago). Si no se cumple, SHALL responder 409 `PAYMENT_NOT_ALLOWED` sin crear pagos ni contactar a MercadoPago.

#### Scenario: Pedido en efectivo
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido `EFECTIVO` en `PENDIENTE`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

#### Scenario: Pedido cancelado
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido `MERCADOPAGO` en `CANCELADO`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED`

#### Scenario: Pedido ya pagado
- **WHEN** el pedido `MERCADOPAGO` de A tiene un pago `aprobado` y A vuelve a llamar a `POST /api/v1/pagos/crear`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y el pedido sigue con un solo pago

#### Scenario: Pago en proceso
- **WHEN** el último pago del pedido de A está `pendiente` con `mp_payment_id` 555 y `mp_status` `in_process`, y A vuelve a llamar a `POST /api/v1/pagos/crear`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y no se contacta a MercadoPago

### Requirement: Resultado sincrónico del cobro
La respuesta 201 de `POST /api/v1/pagos/crear` SHALL reflejar el estado que MercadoPago informa al crear el pago, con el mapeo del webhook. Un pago aprobado SHALL confirmar el pedido en la misma transacción y con los mismos efectos que el webhook (actor Sistema, stock, historial; sin stock, pedido `CANCELADO` y pago `a_devolver`).

#### Scenario: Pago aprobado
- **WHEN** el cliente A crea el pago de su pedido `MERCADOPAGO` en `PENDIENTE` de 2 unidades de un producto con stock 5 y MercadoPago responde `approved` / `accredited`
- **THEN** recibe 201 con `estado` `aprobado` y `mp_status_detail` `accredited`; el pedido queda en `CONFIRMADO` con una fila de historial hacia `CONFIRMADO` con `usuario_id` nulo y el stock queda en 3

#### Scenario: Pago rechazado
- **WHEN** el cliente A crea el pago y MercadoPago responde `rejected` / `cc_rejected_insufficient_amount`
- **THEN** recibe 201 con `estado` `rechazado` y `mp_status_detail` `cc_rejected_insufficient_amount`; el pedido sigue en `PENDIENTE` y el stock no cambia

#### Scenario: Pago en proceso
- **WHEN** el cliente A crea el pago y MercadoPago responde `in_process` / `pending_contingency`
- **THEN** recibe 201 con `estado` `pendiente` y `mp_payment_id` registrado; el pedido sigue en `PENDIENTE`

#### Scenario: Aprobado sin stock
- **WHEN** el cliente A crea el pago de un pedido cuyo producto ya no tiene stock y MercadoPago responde `approved`
- **THEN** recibe 201 con `estado` `a_devolver`; el pedido queda en `CANCELADO` con motivo «Sin stock»

#### Scenario: Webhook posterior al aprobado sincrónico
- **WHEN** después de un cobro aprobado en la creación llega, firmada, la notificación de ese mismo pago aprobado
- **THEN** responde 200 `already_processed` y el pedido, el historial y el stock no cambian

### Requirement: Reintento después de un rechazo
Si el último pago del pedido está `rechazado` y el pedido sigue `MERCADOPAGO` en `PENDIENTE`, un nuevo `POST /api/v1/pagos/crear` SHALL crear un intento nuevo con claves nuevas, conservando los anteriores.

#### Scenario: Rechazo y reintento aprobado
- **WHEN** el primer intento del cliente A es rechazado y A llama de nuevo a `POST /api/v1/pagos/crear` con otro token y MercadoPago aprueba
- **THEN** recibe 201 con `estado` `aprobado`, el pedido tiene dos pagos (el primero `rechazado`, el segundo `aprobado`) y queda en `CONFIRMADO`

#### Scenario: Consulta tras el reintento
- **WHEN** después de ese reintento A llama a `GET /api/v1/pagos/{pedido_id}`
- **THEN** recibe el estado del segundo intento (`aprobado`)

### Requirement: Reintento después de un resultado desconocido
Si al crear un pago MercadoPago no responde o responde un error 5xx, el intento SHALL quedar `pendiente` sin id de MercadoPago y la respuesta SHALL ser 502 `HTTP_502`. Un nuevo `POST /api/v1/pagos/crear` del pedido SHALL reutilizar ese intento, con el mismo `X-Idempotency-Key`, en vez de crear otro.

#### Scenario: MercadoPago no responde
- **WHEN** el cliente A crea el pago y la llamada a MercadoPago falla por red
- **THEN** recibe 502 con `code` `HTTP_502`, el pedido tiene un pago `pendiente` sin `mp_payment_id` y sigue en `PENDIENTE`

#### Scenario: Reintento con la misma clave
- **WHEN** después de esa falla A vuelve a llamar a `POST /api/v1/pagos/crear` y MercadoPago aprueba
- **THEN** recibe 201 con `estado` `aprobado`, el pedido sigue teniendo un solo pago y MercadoPago recibió en ambas llamadas el mismo `X-Idempotency-Key`

### Requirement: Datos rechazados por MercadoPago
Si MercadoPago rechaza la creación con un error 4xx (por ejemplo, token inválido o ya usado) y no crea un pago, la respuesta SHALL ser 400 `HTTP_400` con un `detail` legible que no exponga credenciales, y el intento SHALL quedar `rechazado`, de modo que se pueda reintentar con un token nuevo.

#### Scenario: Token ya usado
- **WHEN** el cliente A crea el pago y MercadoPago responde 400 al crearlo
- **THEN** recibe 400 con `code` `HTTP_400`, el intento queda `rechazado` sin `mp_payment_id` y el pedido sigue en `PENDIENTE`

#### Scenario: Reintento tras datos rechazados
- **WHEN** después de ese 400 A vuelve a crear el pago con otro token y MercadoPago lo aprueba
- **THEN** recibe 201 y el pedido tiene dos pagos con claves distintas

### Requirement: La consulta del pago expone el detalle de MercadoPago
`GET /api/v1/pagos/{pedido_id}` SHALL responder `pedido_id`, `pago_id`, `estado`, `mp_status` y `mp_status_detail` del último intento del pedido; sin intentos, `pago_id`, `estado`, `mp_status` y `mp_status_detail` SHALL ser nulos.

#### Scenario: Último intento rechazado
- **WHEN** el último pago del pedido de A está `rechazado` con `mp_status` `rejected` y `mp_status_detail` `cc_rejected_bad_filled_security_code`, y A llama a `GET /api/v1/pagos/{pedido_id}`
- **THEN** recibe 200 con `estado` `rechazado`, `mp_status` `rejected` y `mp_status_detail` `cc_rejected_bad_filled_security_code`

#### Scenario: Pedido sin intentos
- **WHEN** A llama a `GET /api/v1/pagos/{pedido_id}` de un pedido suyo sin pagos
- **THEN** recibe 200 con `pedido_id` y `pago_id`, `estado`, `mp_status` y `mp_status_detail` nulos

### Requirement: El webhook asocia el pago por su referencia externa
Si el id de pago de MercadoPago no corresponde a ningún pago local, el webhook SHALL buscar el intento cuya `external_reference` es la informada por MercadoPago, no el último pago del pedido. Una referencia que no es un UUID de un intento local SHALL tratarse como no encontrada.

#### Scenario: Notificación de un intento con resultado desconocido
- **WHEN** el pedido `MERCADOPAGO` en `PENDIENTE` de A tiene un intento 1 `rechazado` con `mp_payment_id` 600 y un intento 2 `pendiente` sin id de MercadoPago (creación con 502), y llega firmada la notificación del pago 700 `approved` con la `external_reference` del intento 2
- **THEN** responde 200 `processed`, el intento 2 queda `aprobado` con `mp_payment_id` 700, el intento 1 no cambia y el pedido pasa a `CONFIRMADO`

#### Scenario: Referencia de otro intento
- **WHEN** llega firmada la notificación del pago 800 `rejected`, desconocido localmente, con la `external_reference` del intento 1 `rechazado` de ese pedido
- **THEN** responde 200 `processed`, el intento 1 (no el último del pedido) queda `rechazado` con `mp_payment_id` 800 y el intento 2 no cambia

#### Scenario: Referencia numérica heredada
- **WHEN** llega firmada la notificación de un pago aprobado desconocido con `external_reference` igual a un id de pedido existente (`"42"`)
- **THEN** responde 200 `ignored` y ningún pago ni pedido cambia
