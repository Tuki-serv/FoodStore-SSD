## MODIFIED Requirements

### Requirement: Solo el propietario del pedido o ADMIN operan su pago
Crear o consultar el pago de un pedido SHALL estar permitido al usuario dueño del pedido y a cualquier usuario cuyos roles (leídos de la base en cada request, unión de roles) incluyan `ADMIN`. Cualquier otro usuario autenticado SHALL recibir 403 con `code` `HTTP_403`, sin datos del pedido ni del pago, sin crear pagos y sin contactar a MercadoPago.

#### Scenario: Propietario crea el pago de su pedido
- **WHEN** el cliente A, con MercadoPago configurado, llama a `POST /api/v1/pagos/crear` con el `pedido_id` de su pedido `MERCADOPAGO` en `PENDIENTE` y un token de tarjeta con el que MercadoPago procesa la orden (`processed` / `accredited`)
- **THEN** recibe 201 con `pago_id`, `pedido_id`, `estado` `aprobado`, `mp_order_id`, `mp_payment_id`, `mp_status` `processed` y `mp_status_detail` `accredited`, y el cuerpo no tiene `preference_id`, `init_point` ni `public_key`

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

### Requirement: El webhook exige la firma de MercadoPago
`POST /api/v1/pagos/webhook` SHALL aceptar una notificación solo si el header `x-signature` (`ts=<ts>,v1=<hash>`) contiene un `v1` igual al HMAC-SHA256 en hexadecimal, con la clave secreta configurada, del manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo el par cuyo valor falte. Como `data.id` es el id alfanumérico de una orden de MercadoPago, el manifest SHALL aceptarse calculado con `data.id` en minúsculas o con `data.id` tal como llegó en la query. La comparación SHALL ser en tiempo constante. Si ninguna variante coincide, SHALL responder 401 `HTTP_401` sin consultar a MercadoPago ni modificar datos.

#### Scenario: Firma válida
- **WHEN** llega una notificación `type=order` con `data.id=ORD01ABC` en la query, `x-request-id` `abc` y un `x-signature` cuyo `v1` es el HMAC-SHA256 con la clave configurada de `id:ord01abc;request-id:abc;ts:1742505638683;`
- **THEN** la firma se acepta y la notificación se procesa (no 401)

#### Scenario: Firma válida con el id tal como llegó
- **WHEN** llega la misma notificación con un `v1` calculado sobre `id:ORD01ABC;request-id:abc;ts:1742505638683;`
- **THEN** la firma se acepta (no 401)

#### Scenario: Sin header de firma
- **WHEN** llega una notificación `type=order` sin header `x-signature`
- **THEN** recibe 401 con `code` `HTTP_401`, no se consulta a MercadoPago y ningún pago ni pedido cambia

#### Scenario: Firma con otra clave
- **WHEN** llega una notificación cuyo `v1` se calculó con una clave distinta de la configurada
- **THEN** recibe 401 y ningún pago ni pedido cambia

#### Scenario: Id alterado después de firmar
- **WHEN** llega una notificación firmada para `data.id=ORD01ABC` pero la query dice `data.id=ORD01ABD`
- **THEN** recibe 401 y no se consulta a MercadoPago

#### Scenario: Header mal formado
- **WHEN** llega una notificación con `x-signature` igual a `basura`
- **THEN** recibe 401

#### Scenario: El cuerpo de error no revela el motivo
- **WHEN** una notificación se rechaza por firma
- **THEN** el `detail` de la respuesta es genérico y no indica qué parte de la firma falló

### Requirement: El webhook procesa el id de pago firmado
El webhook SHALL procesar notificaciones del tópico `order` (Orders API). El id que procesa SHALL ser el `data.id` de la query, que es el que cubre la firma, y SHALL tratarse como el id de texto de una orden de MercadoPago. Si la query no trae `data.id`, SHALL usarse el `data.id` del cuerpo. Si la query y el cuerpo traen ids distintos, SHALL responder 400 `HTTP_400` sin consultar a MercadoPago. El estado SHALL leerse siempre consultando la orden a MercadoPago, nunca del cuerpo de la notificación. Las notificaciones de otros tópicos (incluidos `payment` y `merchant_order`) SHALL responder 200 `ignored` sin consultar a MercadoPago.

#### Scenario: Ids distintos en query y cuerpo
- **WHEN** llega una notificación `type=order` correctamente firmada con `data.id=ORD01ABC` en la query y `{"data": {"id": "ORD01XYZ"}}` en el cuerpo
- **THEN** recibe 400 y no se consulta a MercadoPago

#### Scenario: Id solo en la query
- **WHEN** llega una notificación `type=order` firmada con `data.id=ORD01ABC` en la query y un cuerpo sin `data`
- **THEN** se consulta a MercadoPago la orden `ORD01ABC`

#### Scenario: El estado del cuerpo no manda
- **WHEN** llega una notificación `type=order` firmada cuyo cuerpo dice `status` `processed` y MercadoPago, al consultar la orden, informa `failed`
- **THEN** el pago local queda `rechazado`, no `aprobado`

#### Scenario: Notificación del tópico payment
- **WHEN** llega una notificación firmada `type=payment` con `data.id=123`
- **THEN** recibe 200 con `status` `ignored`, no se consulta a MercadoPago y nada cambia

### Requirement: Webhook sin configuración de MercadoPago
Sin `MP_WEBHOOK_SECRET` el webhook SHALL responder 503 `HTTP_503` con un `detail` que nombre `MP_WEBHOOK_SECRET`, antes de evaluar la firma y sin procesar nada. Una notificación `order` con firma válida sin `MP_ACCESS_TOKEN` SHALL responder 503 nombrando `MP_ACCESS_TOKEN`, sin modificar datos. Si MercadoPago rechaza las credenciales al consultar la orden (401 o 403), SHALL responder 503 `HTTP_503` sin modificar datos. En todos los casos MercadoPago reintenta.

#### Scenario: Sin clave secreta
- **WHEN** `MP_WEBHOOK_SECRET` no está definida y llega cualquier notificación al webhook, firmada o no
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que menciona `MP_WEBHOOK_SECRET`, y ningún pago ni pedido cambia

#### Scenario: Sin access token
- **WHEN** `MP_WEBHOOK_SECRET` está definida, `MP_ACCESS_TOKEN` no, y llega una notificación `type=order` con firma válida
- **THEN** recibe 503 con un `detail` que menciona `MP_ACCESS_TOKEN` y ningún pago ni pedido cambia

#### Scenario: Tópico no soportado sin access token
- **WHEN** `MP_WEBHOOK_SECRET` está definida, `MP_ACCESS_TOKEN` no, y llega una notificación `type=merchant_order` con firma válida
- **THEN** recibe 200 con `status` `ignored`

#### Scenario: Credenciales rechazadas al consultar la orden
- **WHEN** llega una notificación `type=order` firmada y MercadoPago responde 401 al consultar la orden
- **THEN** recibe 503 con `code` `HTTP_503` y ningún pago ni pedido cambia

### Requirement: Idempotencia del webhook por pago de MercadoPago
Cada notificación SHALL resolverse sobre el pago local asociado al id de orden de MercadoPago (o, si ninguno lo tiene, a su referencia externa), serializando las notificaciones concurrentes de la misma orden. Una reentrega que no cambia el estado local, o cualquier notificación sobre un pago local `aprobado` o `a_devolver`, SHALL responder 200 `already_processed` sin modificar pagos, pedidos, stock ni historial.

#### Scenario: Reentrega del mismo pago aprobado
- **WHEN** MercadoPago entrega dos veces, con firmas válidas, la notificación de la orden `processed` de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente
- **THEN** la primera responde 200 `processed`; la segunda responde 200 `already_processed`; el pedido queda en `CONFIRMADO` con una sola fila de historial hacia `CONFIRMADO` y el stock se descontó una sola vez

#### Scenario: Notificaciones concurrentes del mismo pago
- **WHEN** dos notificaciones firmadas de la misma orden `processed` se procesan en paralelo
- **THEN** exactamente una confirma el pedido; el stock se descuenta una sola vez y el historial suma una sola fila

#### Scenario: Reentrega de un pago rechazado
- **WHEN** MercadoPago reentrega la notificación de una orden ya registrada como `rechazado` con el mismo id de orden
- **THEN** responde 200 `already_processed` y nada cambia

#### Scenario: Nuevo intento aprobado tras un rechazo
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` quedó `rechazado` por la orden `ORD01AAA` y llega, firmada, la notificación de la orden `ORD01BBB` `processed` con la misma referencia externa
- **THEN** responde 200 `processed`, el pago local queda `aprobado` con `mp_order_id` `ORD01BBB` y el pedido pasa a `CONFIRMADO`

#### Scenario: Orden en proceso que luego se procesa
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` está `pendiente` con `mp_order_id` `ORD01AAA` (`processing`) y llega, firmada, la notificación de esa orden que MercadoPago ahora informa `processed`
- **THEN** responde 200 `processed`, el pago local queda `aprobado` y el pedido pasa a `CONFIRMADO`

#### Scenario: Cambio posterior de un pago ya aprobado
- **WHEN** llega una notificación firmada de una orden cuyo pago local está `aprobado` y MercadoPago ahora informa `refunded`
- **THEN** responde 200 `already_processed` y ni el pago local ni el pedido cambian

#### Scenario: Pago sin pago local asociado
- **WHEN** llega una notificación firmada de una orden `processed` cuyo id y cuya referencia externa no corresponden a ningún pago local
- **THEN** responde 200 `ignored` y no se crea ningún pago

### Requirement: Códigos de respuesta del webhook
Con firma válida, el webhook SHALL responder 200 cuando procesa, ignora o deduplica una notificación y ante una falla de negocio conocida (sin stock o pedido que el Sistema no puede confirmar). SHALL responder 502 `HTTP_502` si la consulta de la orden a MercadoPago falla por red, 5xx o respuesta inesperada, 503 `HTTP_503` si MercadoPago rechaza las credenciales, y 500 `INTERNAL_ERROR` ante cualquier otra falla inesperada, sin dejar cambios. Nunca SHALL responder 2xx a un error inesperado.

#### Scenario: MercadoPago no responde
- **WHEN** llega una notificación firmada y la consulta de la orden a MercadoPago devuelve un estado 5xx
- **THEN** recibe 502 con `code` `HTTP_502` y ningún pago ni pedido cambia

#### Scenario: Sin stock no hace reintentar
- **WHEN** llega la notificación firmada de la orden `processed` de un pedido `MERCADOPAGO` en `PENDIENTE` cuyo producto ya no tiene stock
- **THEN** recibe 200, el pedido queda en `CANCELADO` con motivo «Sin stock» y el pago local `a_devolver`

#### Scenario: Estado de MercadoPago desconocido
- **WHEN** llega una notificación firmada de una orden que MercadoPago informa con un estado no mapeado
- **THEN** recibe 200 con `status` `ignored` y nada cambia

## ADDED Requirements

### Requirement: Crear un pago con token de tarjeta
`POST /api/v1/pagos/crear` SHALL recibir `pedido_id`, `token`, `payment_method_id`, `payment_type_id` (`credit_card` o `debit_card`), `installments` (entero ≥ 1), `issuer_id` opcional y `payer` (`email`, `identification` opcional), y SHALL crear en MercadoPago una orden online de procesamiento automático con una transacción de pago por el total del pedido, con los montos como texto con 2 decimales. Un cuerpo inválido SHALL responder 422 `VALIDATION_ERROR` sin contactar a MercadoPago.

#### Scenario: Cobro con los datos del brick
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `pedido_id` de su pedido `MERCADOPAGO` en `PENDIENTE` de total `1500.50`, `token` `tok-1`, `payment_method_id` `visa`, `payment_type_id` `credit_card`, `installments` 1, `issuer_id` `310` y `payer.email` `a@test.com`
- **THEN** MercadoPago recibe una orden `type` `online`, `processing_mode` `automatic`, `total_amount` `"1500.50"` y una transacción de pago con `amount` `"1500.50"` y `payment_method` `{id: visa, type: credit_card, token: tok-1, installments: 1}`, `payer.email` `a@test.com`, sin `issuer_id` ni `notification_url`

#### Scenario: Monto con un decimal
- **WHEN** el pedido de A tiene total `0.10` y A crea su pago
- **THEN** MercadoPago recibe `total_amount` `"0.10"` y `amount` `"0.10"`

#### Scenario: Falta el token
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `pedido_id` de su pedido y sin `token`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR` y `field` `token`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

#### Scenario: Falta el tipo de medio de pago
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` sin `payment_type_id`, o con `payment_type_id` `ticket`
- **THEN** recibe 422 con `field` `payment_type_id` y no se contacta a MercadoPago

#### Scenario: Cuotas inválidas
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con `installments` 0
- **THEN** recibe 422 con `field` `installments`

### Requirement: Los datos de la tarjeta nunca llegan al backend
El backend SHALL aceptar solo el token de la tarjeta generado en el navegador. Un cuerpo de `POST /api/v1/pagos/crear` con campos fuera del contrato (por ejemplo número, código de seguridad o vencimiento de la tarjeta) SHALL responder 422 sin contactar a MercadoPago, y ningún dato de tarjeta SHALL guardarse ni registrarse en el log.

#### Scenario: Número de tarjeta en el cuerpo
- **WHEN** el cliente A llama a `POST /api/v1/pagos/crear` con un cuerpo válido más `card_number` `4509953566233704`
- **THEN** recibe 422 con `code` `VALIDATION_ERROR`, no se crea ninguna fila en `pagos` y no se contacta a MercadoPago

### Requirement: Cada intento de pago tiene claves propias
Cada intento de pago SHALL tener un `idempotency_key` y una `external_reference` UUID únicos y obligatorios, generados por el backend. El intento SHALL guardarse como `pendiente` antes de contactar a MercadoPago, y la orden SHALL crearse con el header `X-Idempotency-Key` igual a su `idempotency_key` y con `external_reference` igual a la suya. El id de la orden que MercadoPago devuelva SHALL guardarse en el intento y ser único entre los pagos.

#### Scenario: Claves enviadas a MercadoPago
- **WHEN** el cliente A crea el pago de su pedido y MercadoPago procesa la orden
- **THEN** la fila de `pagos` tiene `idempotency_key` y `external_reference` con formato UUID y `mp_order_id` igual al id de la orden, y la llamada a MercadoPago llevó `X-Idempotency-Key` igual a ese `idempotency_key` y `external_reference` igual a esa referencia

#### Scenario: Intentos distintos, claves distintas
- **WHEN** el cliente A crea un pago cuya orden falla y luego otro cuya orden se procesa
- **THEN** el pedido tiene dos filas en `pagos` con `idempotency_key`, `external_reference` y `mp_order_id` distintos

### Requirement: Precondiciones para cobrar un pedido
Crear un pago SHALL exigir que el pedido sea `MERCADOPAGO`, esté en `PENDIENTE` y no tenga un pago `aprobado` o `a_devolver` ni un pago en proceso en MercadoPago (`pendiente` con orden de MercadoPago creada). Si no se cumple, SHALL responder 409 `PAYMENT_NOT_ALLOWED` sin crear pagos ni contactar a MercadoPago.

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
- **WHEN** el último pago del pedido de A está `pendiente` con `mp_order_id` `ORD01AAA` y `mp_status` `processing`, y A vuelve a llamar a `POST /api/v1/pagos/crear`
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y no se contacta a MercadoPago

### Requirement: Resultado sincrónico del cobro
La respuesta 201 de `POST /api/v1/pagos/crear` SHALL reflejar el estado de la orden que MercadoPago informa al crearla, con el mapeo de «Estados de la orden de MercadoPago». Una respuesta 402 que trae la orden fallida SHALL tratarse como resultado (201 `rechazado`), no como error. Un pago aprobado SHALL confirmar el pedido en la misma transacción y con los mismos efectos que el webhook (actor Sistema, stock, historial; sin stock, pedido `CANCELADO` y pago `a_devolver`).

#### Scenario: Orden procesada
- **WHEN** el cliente A crea el pago de su pedido `MERCADOPAGO` en `PENDIENTE` de 2 unidades de un producto con stock 5 y MercadoPago responde la orden `processed` / `accredited`
- **THEN** recibe 201 con `estado` `aprobado` y `mp_status_detail` `accredited`; el pedido queda en `CONFIRMADO` con una fila de historial hacia `CONFIRMADO` con `usuario_id` nulo y el stock queda en 3

#### Scenario: Orden fallida con 402
- **WHEN** el cliente A crea el pago y MercadoPago responde 402 con la orden `failed` y su transacción `failed` / `insufficient_amount`
- **THEN** recibe 201 con `estado` `rechazado`, `mp_status` `failed` y `mp_status_detail` `insufficient_amount`; el intento guarda el id de la orden; el pedido sigue en `PENDIENTE` y el stock no cambia

#### Scenario: Orden en proceso
- **WHEN** el cliente A crea el pago y MercadoPago responde la orden `processing` / `in_process`
- **THEN** recibe 201 con `estado` `pendiente` y `mp_order_id` registrado; el pedido sigue en `PENDIENTE`

#### Scenario: Orden que requiere acción
- **WHEN** el cliente A crea el pago y MercadoPago responde la orden `action_required` / `pending_challenge`
- **THEN** recibe 201 con `estado` `pendiente`; el pedido sigue en `PENDIENTE`

#### Scenario: Aprobado sin stock
- **WHEN** el cliente A crea el pago de un pedido cuyo producto ya no tiene stock y MercadoPago responde la orden `processed`
- **THEN** recibe 201 con `estado` `a_devolver`; el pedido queda en `CANCELADO` con motivo «Sin stock»

#### Scenario: Webhook posterior al aprobado sincrónico
- **WHEN** después de un cobro aprobado en la creación llega, firmada, la notificación `order` de esa misma orden `processed`
- **THEN** responde 200 `already_processed` y el pedido, el historial y el stock no cambian

### Requirement: Estados de la orden de MercadoPago
La creación y el webhook SHALL mapear el estado de la orden así: `processed` → `aprobado`; `failed`, `canceled`, `refunded` y `charged_back` → `rechazado`; `created`, `processing` y `action_required` → `pendiente`. `mp_status` SHALL guardar el estado de la orden y `mp_status_detail` el detalle de su transacción de pago, o el de la orden si no hay transacción.

#### Scenario: Detalle de la transacción
- **WHEN** MercadoPago informa la orden `failed` / `failed` con su transacción `failed` / `rejected_by_issuer`
- **THEN** el pago local queda `rechazado` con `mp_status` `failed` y `mp_status_detail` `rejected_by_issuer`

#### Scenario: Orden cancelada por vencimiento
- **WHEN** MercadoPago informa la orden `canceled` / `expired`
- **THEN** el pago local queda `rechazado`

### Requirement: Reintento después de un rechazo
Si el último pago del pedido está `rechazado` y el pedido sigue `MERCADOPAGO` en `PENDIENTE`, un nuevo `POST /api/v1/pagos/crear` SHALL crear un intento nuevo con claves nuevas, conservando los anteriores.

#### Scenario: Rechazo y reintento aprobado
- **WHEN** el primer intento del cliente A termina con la orden `failed` y A llama de nuevo a `POST /api/v1/pagos/crear` con otro token y MercadoPago procesa la orden
- **THEN** recibe 201 con `estado` `aprobado`, el pedido tiene dos pagos (el primero `rechazado`, el segundo `aprobado`) y queda en `CONFIRMADO`

#### Scenario: Consulta tras el reintento
- **WHEN** después de ese reintento A llama a `GET /api/v1/pagos/{pedido_id}`
- **THEN** recibe el estado del segundo intento (`aprobado`)

### Requirement: Reintento después de un resultado desconocido
Si al crear la orden MercadoPago no responde, responde un error 5xx o responde 423 (clave de idempotencia en uso), el intento SHALL quedar `pendiente` sin id de orden y la respuesta SHALL ser 502 `HTTP_502`. Un nuevo `POST /api/v1/pagos/crear` del pedido SHALL reutilizar ese intento, con el mismo `X-Idempotency-Key` y la misma `external_reference`, en vez de crear otro.

#### Scenario: MercadoPago no responde
- **WHEN** el cliente A crea el pago y la llamada a MercadoPago falla por red
- **THEN** recibe 502 con `code` `HTTP_502`, el pedido tiene un pago `pendiente` sin `mp_order_id` y sigue en `PENDIENTE`

#### Scenario: Reintento con la misma clave
- **WHEN** después de esa falla A vuelve a llamar a `POST /api/v1/pagos/crear` y MercadoPago procesa la orden
- **THEN** recibe 201 con `estado` `aprobado`, el pedido sigue teniendo un solo pago y MercadoPago recibió en ambas llamadas el mismo `X-Idempotency-Key`

### Requirement: Reconciliación tras una clave de idempotencia ya usada
Si al crear la orden MercadoPago responde que el `X-Idempotency-Key` ya se usó, el backend SHALL buscar la orden por la `external_reference` del intento y aplicar su resultado como el de una creación. Si no la encuentra, SHALL responder 502 `HTTP_502` y el intento SHALL seguir reutilizable.

#### Scenario: Clave ya usada y orden encontrada
- **WHEN** después de una falla por red A reintenta, MercadoPago responde 409 `idempotency_key_already_used` y la búsqueda por la `external_reference` del intento devuelve una orden `processed`
- **THEN** recibe 201 con `estado` `aprobado`, el intento guarda el id de esa orden y el pedido queda en `CONFIRMADO` con un solo pago

#### Scenario: Clave ya usada y orden no encontrada
- **WHEN** MercadoPago responde 409 `idempotency_key_already_used` y la búsqueda por `external_reference` no devuelve ninguna orden
- **THEN** recibe 502 con `code` `HTTP_502` y el intento sigue `pendiente` sin `mp_order_id`

### Requirement: Datos rechazados por MercadoPago
Si MercadoPago rechaza la creación de la orden con un error 4xx de validación (por ejemplo, token inválido, propiedad faltante o con valor inválido) y no crea una orden, la respuesta SHALL ser 400 `HTTP_400` con un `detail` legible que no exponga credenciales, y el intento SHALL quedar `rechazado` con el código de error de MercadoPago en `mp_status_detail`, de modo que se pueda reintentar con un token nuevo.

#### Scenario: Token rechazado por validación
- **WHEN** el cliente A crea el pago y MercadoPago responde 400 con el error `property_value` al crear la orden
- **THEN** recibe 400 con `code` `HTTP_400`, el intento queda `rechazado` sin `mp_order_id` con `mp_status_detail` `property_value`, y el pedido sigue en `PENDIENTE`

#### Scenario: Reintento tras datos rechazados
- **WHEN** después de ese 400 A vuelve a crear el pago con otro token y MercadoPago procesa la orden
- **THEN** recibe 201 y el pedido tiene dos pagos con claves distintas

### Requirement: Credenciales de MercadoPago rechazadas
Si MercadoPago responde 401 o 403 al crear la orden, la respuesta SHALL ser 503 `HTTP_503` con `field` nulo y un `detail` que indique que MercadoPago rechazó las credenciales configuradas, sin repetir el access token ni datos de la tarjeta, y nunca 400 «MercadoPago rechazó los datos del pago». El intento SHALL quedar `pendiente` sin id de orden y reutilizable, y el pedido SHALL seguir en `PENDIENTE`.

#### Scenario: Credenciales rechazadas al crear
- **WHEN** el cliente A crea el pago de su pedido y MercadoPago responde 401 `invalid_credentials`
- **THEN** recibe 503 con `code` `HTTP_503`, `field` nulo y un `detail` que menciona las credenciales de MercadoPago y no contiene el access token; el intento queda `pendiente` sin `mp_order_id`; el pedido sigue en `PENDIENTE`

#### Scenario: Reintento tras corregir las credenciales
- **WHEN** después de ese 503 se corrigen las credenciales y A vuelve a crear el pago y MercadoPago procesa la orden
- **THEN** recibe 201 `aprobado`, el pedido tiene un solo pago y ambas llamadas llevaron el mismo `X-Idempotency-Key`

### Requirement: La consulta del pago expone el detalle de MercadoPago
`GET /api/v1/pagos/{pedido_id}` SHALL responder `pedido_id`, `pago_id`, `estado`, `mp_status` y `mp_status_detail` del último intento del pedido; sin intentos, `pago_id`, `estado`, `mp_status` y `mp_status_detail` SHALL ser nulos.

#### Scenario: Último intento rechazado
- **WHEN** el último pago del pedido de A está `rechazado` con `mp_status` `failed` y `mp_status_detail` `bad_filled_card_data`, y A llama a `GET /api/v1/pagos/{pedido_id}`
- **THEN** recibe 200 con `estado` `rechazado`, `mp_status` `failed` y `mp_status_detail` `bad_filled_card_data`

#### Scenario: Pedido sin intentos
- **WHEN** A llama a `GET /api/v1/pagos/{pedido_id}` de un pedido suyo sin pagos
- **THEN** recibe 200 con `pedido_id` y `pago_id`, `estado`, `mp_status` y `mp_status_detail` nulos

### Requirement: El webhook asocia el pago por su referencia externa
Si el id de la orden de MercadoPago no corresponde a ningún pago local, el webhook SHALL buscar el intento cuya `external_reference` es la informada por MercadoPago en la orden, no el último pago del pedido. Una referencia que no es un UUID de un intento local SHALL tratarse como no encontrada.

#### Scenario: Notificación de un intento con resultado desconocido
- **WHEN** el pedido `MERCADOPAGO` en `PENDIENTE` de A tiene un intento 1 `rechazado` con `mp_order_id` `ORD01AAA` y un intento 2 `pendiente` sin orden (creación con 502), y llega firmada la notificación de la orden `ORD01BBB` `processed` con la `external_reference` del intento 2
- **THEN** responde 200 `processed`, el intento 2 queda `aprobado` con `mp_order_id` `ORD01BBB`, el intento 1 no cambia y el pedido pasa a `CONFIRMADO`

#### Scenario: Referencia de otro intento
- **WHEN** llega firmada la notificación de la orden `ORD01CCC` `failed`, desconocida localmente, con la `external_reference` del intento 1 `rechazado` sin orden de ese pedido
- **THEN** responde 200 `processed`, el intento 1 (no el último del pedido) queda `rechazado` con `mp_order_id` `ORD01CCC` y el intento 2 no cambia

#### Scenario: Referencia numérica heredada
- **WHEN** llega firmada la notificación de una orden `processed` desconocida con `external_reference` igual a un id de pedido existente (`"42"`)
- **THEN** responde 200 `ignored` y ningún pago ni pedido cambia
