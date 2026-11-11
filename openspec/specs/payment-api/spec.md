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
`POST /api/v1/pagos/webhook` SHALL seguir siendo público respecto del usuario: no exige token Bearer (lo invoca MercadoPago), pero SHALL exigir la firma de MercadoPago (ver «El webhook exige la firma de MercadoPago»). `GET /api/v1/pagos/redirect/{pedido_id}/{status}` SHALL seguir siendo público mientras exista el flujo Checkout Pro, porque lo abre el navegador al volver de MercadoPago, y no SHALL exponer datos del pedido ni del pago.

#### Scenario: Webhook sin token
- **WHEN** MercadoPago envía `POST /api/v1/pagos/webhook` con un tópico no soportado, firma válida y sin header `Authorization`
- **THEN** recibe 200 con `status` `ignored` (no 401)

#### Scenario: Webhook sin token ni firma
- **WHEN** se envía `POST /api/v1/pagos/webhook` sin header `Authorization` ni `x-signature`, con `MP_WEBHOOK_SECRET` definida
- **THEN** recibe 401 por la firma

#### Scenario: Redirect sin token
- **WHEN** el navegador abre `GET /api/v1/pagos/redirect/{pedido_id}/success` sin header `Authorization` y `FRONTEND_URL` está definida
- **THEN** recibe una redirección al frontend (no 401)

### Requirement: El webhook exige la firma de MercadoPago
`POST /api/v1/pagos/webhook` SHALL aceptar una notificación solo si el header `x-signature` (`ts=<ts>,v1=<hash>`) contiene un `v1` igual al HMAC-SHA256 en hexadecimal, con la clave secreta configurada, del manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo el par cuyo valor falte. La comparación SHALL ser en tiempo constante. Si no, SHALL responder 401 `HTTP_401` sin consultar a MercadoPago ni modificar datos.

#### Scenario: Firma válida
- **WHEN** llega una notificación `type=payment` con `data.id=123` en la query, `x-request-id` `abc` y un `x-signature` cuyo `v1` es el HMAC-SHA256 con la clave configurada de `id:123;request-id:abc;ts:1742505638683;`
- **THEN** la firma se acepta y la notificación se procesa (no 401)

#### Scenario: Sin header de firma
- **WHEN** llega una notificación `type=payment` sin header `x-signature`
- **THEN** recibe 401 con `code` `HTTP_401`, no se consulta a MercadoPago y ningún pago ni pedido cambia

#### Scenario: Firma con otra clave
- **WHEN** llega una notificación cuyo `v1` se calculó con una clave distinta de la configurada
- **THEN** recibe 401 y ningún pago ni pedido cambia

#### Scenario: Id alterado después de firmar
- **WHEN** llega una notificación firmada para `data.id=123` pero la query dice `data.id=124`
- **THEN** recibe 401 y no se consulta a MercadoPago

#### Scenario: Header mal formado
- **WHEN** llega una notificación con `x-signature` igual a `basura`
- **THEN** recibe 401

#### Scenario: El cuerpo de error no revela el motivo
- **WHEN** una notificación se rechaza por firma
- **THEN** el `detail` de la respuesta es genérico y no indica qué parte de la firma falló

### Requirement: El webhook procesa el id de pago firmado
El id de pago que el webhook procesa SHALL ser el `data.id` de la query, que es el que cubre la firma. Si la query no trae `data.id`, SHALL usarse el `data.id` del cuerpo. Si la query y el cuerpo traen ids distintos, SHALL responder 400 `HTTP_400` sin consultar a MercadoPago.

#### Scenario: Ids distintos en query y cuerpo
- **WHEN** llega una notificación correctamente firmada con `data.id=123` en la query y `{"data": {"id": "999"}}` en el cuerpo
- **THEN** recibe 400 y no se consulta a MercadoPago

#### Scenario: Id solo en la query
- **WHEN** llega una notificación firmada con `data.id=123` en la query y un cuerpo sin `data`
- **THEN** se consulta a MercadoPago el pago 123

### Requirement: Webhook sin configuración de MercadoPago
Sin `MP_WEBHOOK_SECRET` el webhook SHALL responder 503 `HTTP_503` con un `detail` que nombre `MP_WEBHOOK_SECRET`, antes de evaluar la firma y sin procesar nada. Una notificación `payment` con firma válida sin `MP_ACCESS_TOKEN` SHALL responder 503 nombrando `MP_ACCESS_TOKEN`, sin modificar datos. En ambos casos MercadoPago reintenta.

#### Scenario: Sin clave secreta
- **WHEN** `MP_WEBHOOK_SECRET` no está definida y llega cualquier notificación al webhook, firmada o no
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que menciona `MP_WEBHOOK_SECRET`, y ningún pago ni pedido cambia

#### Scenario: Sin access token
- **WHEN** `MP_WEBHOOK_SECRET` está definida, `MP_ACCESS_TOKEN` no, y llega una notificación `type=payment` con firma válida
- **THEN** recibe 503 con un `detail` que menciona `MP_ACCESS_TOKEN` y ningún pago ni pedido cambia

#### Scenario: Tópico no soportado sin access token
- **WHEN** `MP_WEBHOOK_SECRET` está definida, `MP_ACCESS_TOKEN` no, y llega una notificación `type=merchant_order` con firma válida
- **THEN** recibe 200 con `status` `ignored`

### Requirement: Idempotencia del webhook por pago de MercadoPago
Cada notificación SHALL resolverse sobre el pago local asociado al id de pago de MercadoPago, serializando las notificaciones concurrentes del mismo pago. Una reentrega que no cambia el estado local, o cualquier notificación sobre un pago local `aprobado` o `a_devolver`, SHALL responder 200 `already_processed` sin modificar pagos, pedidos, stock ni historial.

#### Scenario: Reentrega del mismo pago aprobado
- **WHEN** MercadoPago entrega dos veces, con firmas válidas, la notificación del pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente
- **THEN** la primera responde 200 `processed`; la segunda responde 200 `already_processed`; el pedido queda en `CONFIRMADO` con una sola fila de historial hacia `CONFIRMADO` y el stock se descontó una sola vez

#### Scenario: Notificaciones concurrentes del mismo pago
- **WHEN** dos notificaciones firmadas del mismo pago aprobado se procesan en paralelo
- **THEN** exactamente una confirma el pedido; el stock se descuenta una sola vez y el historial suma una sola fila

#### Scenario: Reentrega de un pago rechazado
- **WHEN** MercadoPago reentrega la notificación de un pago ya registrado como `rechazado` con el mismo id
- **THEN** responde 200 `already_processed` y nada cambia

#### Scenario: Nuevo intento aprobado tras un rechazo
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` quedó `rechazado` por el pago 100 y llega, firmada, la notificación del pago 101 aprobado con la misma referencia externa
- **THEN** responde 200 `processed`, el pago local queda `aprobado` con el id 101 y el pedido pasa a `CONFIRMADO`

#### Scenario: Cambio posterior de un pago ya aprobado
- **WHEN** llega una notificación firmada de un pago cuyo pago local está `aprobado` y MercadoPago ahora informa `refunded`
- **THEN** responde 200 `already_processed` y ni el pago local ni el pedido cambian

#### Scenario: Pago sin pago local asociado
- **WHEN** llega una notificación firmada de un pago aprobado cuya referencia externa no corresponde a ningún pago local
- **THEN** responde 200 `ignored` y no se crea ningún pago

### Requirement: Pago y pedido se actualizan en una sola transacción
Al procesar un pago aprobado, la actualización del pago local, la transición del pedido con actor Sistema, el descuento de stock y la fila de historial SHALL confirmarse juntos o no confirmarse. Nunca SHALL quedar un pago `aprobado` con su pedido en `PENDIENTE`.

#### Scenario: Falla a mitad de la confirmación
- **WHEN** se procesa la notificación firmada del pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` y el paso de confirmación falla de forma inesperada
- **THEN** la respuesta es 500, el pago local releído sigue `pendiente`, el pedido sigue en `PENDIENTE`, el historial no suma filas y el stock no cambió

#### Scenario: Reintento después de la falla
- **WHEN** después de esa falla MercadoPago reintenta la misma notificación y el paso de confirmación ya no falla
- **THEN** responde 200 `processed`, el pago local queda `aprobado`, el pedido en `CONFIRMADO` y el stock se descontó una vez

#### Scenario: Actor Sistema en la confirmación automática
- **WHEN** el webhook confirma un pedido `MERCADOPAGO` por un pago aprobado
- **THEN** la fila de historial nueva va de `PENDIENTE` a `CONFIRMADO` con `usuario_id` nulo

### Requirement: Códigos de respuesta del webhook
Con firma válida, el webhook SHALL responder 200 cuando procesa, ignora o deduplica una notificación y ante una falla de negocio conocida (sin stock o pedido que el Sistema no puede confirmar). SHALL responder 502 `HTTP_502` si la consulta a MercadoPago falla y 500 `INTERNAL_ERROR` ante cualquier otra falla inesperada, sin dejar cambios. Nunca SHALL responder 2xx a un error inesperado.

#### Scenario: MercadoPago no responde
- **WHEN** llega una notificación firmada y la consulta del pago a MercadoPago devuelve un estado distinto de 200
- **THEN** recibe 502 con `code` `HTTP_502` y ningún pago ni pedido cambia

#### Scenario: Sin stock no hace reintentar
- **WHEN** llega la notificación firmada del pago aprobado de un pedido `MERCADOPAGO` en `PENDIENTE` cuyo producto ya no tiene stock
- **THEN** recibe 200, el pedido queda en `CANCELADO` con motivo «Sin stock» y el pago local `a_devolver`

#### Scenario: Estado de MercadoPago desconocido
- **WHEN** llega una notificación firmada de un pago que MercadoPago informa con un estado no mapeado
- **THEN** recibe 200 con `status` `ignored` y nada cambia

### Requirement: Pago aprobado de un pedido que el Sistema no puede confirmar
Si el pago aprobado corresponde a un pedido que la máquina de estados no permite confirmar al Sistema (no `MERCADOPAGO`, no `PENDIENTE`), el pedido, su historial y el stock no SHALL cambiar; el pago local SHALL quedar `a_devolver` con el id y el estado de MercadoPago registrados; y el webhook SHALL responder 200.

#### Scenario: Pedido ya cancelado
- **WHEN** llega la notificación firmada del pago aprobado de un pedido `MERCADOPAGO` en `CANCELADO`
- **THEN** responde 200, el pedido sigue en `CANCELADO` sin filas nuevas de historial y el pago local queda `a_devolver`

#### Scenario: Pedido que no es de MercadoPago
- **WHEN** llega la notificación firmada del pago aprobado asociado a un pedido `EFECTIVO` en `PENDIENTE`
- **THEN** responde 200, el pedido sigue en `PENDIENTE` sin filas nuevas de historial y el pago local queda `a_devolver`

#### Scenario: Consulta del pago a devolver
- **WHEN** el dueño consulta `GET /api/v1/pagos/{pedido_id}` de ese pedido cancelado
- **THEN** la respuesta tiene `estado` igual a `a_devolver`
