## MODIFIED Requirements

### Requirement: Estados de la orden de MercadoPago
La creación y el webhook SHALL mapear el estado de la orden así: `processed` y `partially_refunded` → `aprobado`; `failed`, `canceled`, `refunded` y `charged_back` → `rechazado`; `created`, `processing` y `action_required` → `pendiente`. `mp_status` SHALL guardar el estado de la orden y `mp_status_detail` el detalle de su transacción de pago, o el de la orden si no hay transacción. *(`partially_refunded` supone la opción recomendada de OQ-1.)*

#### Scenario: Detalle de la transacción
- **WHEN** MercadoPago informa la orden `failed` / `failed` con su transacción `failed` / `rejected_by_issuer`
- **THEN** el pago local queda `rechazado` con `mp_status` `failed` y `mp_status_detail` `rejected_by_issuer`

#### Scenario: Orden cancelada por vencimiento
- **WHEN** MercadoPago informa la orden `canceled` / `expired`
- **THEN** el pago local queda `rechazado`

#### Scenario: Orden cancelada informada por el webhook
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` está `pendiente` con la orden `ORD01AAA` y llega, firmada, la notificación de esa orden que MercadoPago informa `canceled`
- **THEN** responde 200 `processed`, el pago local queda `rechazado` con `mp_status` `canceled` y el pedido sigue en `PENDIENTE`

#### Scenario: Contracargo sobre un pago no aprobado
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` está `pendiente` con la orden `ORD01AAA` y MercadoPago informa esa orden `charged_back`
- **THEN** el pago local queda `rechazado` con `mp_status` `charged_back` y el pedido sigue en `PENDIENTE`

#### Scenario: Orden recién creada
- **WHEN** el cliente crea el pago y MercadoPago responde la orden `created`
- **THEN** recibe 201 con `estado` `pendiente` y `mp_status` `created`; el pedido sigue en `PENDIENTE`

#### Scenario: Orden creada informada por el webhook
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` está `pendiente` sin orden y llega, firmada, la notificación de una orden `created` con su referencia externa
- **THEN** responde 200 `processed`, el pago local sigue `pendiente` con `mp_status` `created` y el pedido sigue en `PENDIENTE`

#### Scenario: Orden reembolsada en parte antes de la primera notificación
- **WHEN** el pago local de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente está `pendiente` y la primera notificación firmada que llega es de su orden, que MercadoPago informa `partially_refunded` con el monto del pago
- **THEN** responde 200 `processed`, el pago local queda `aprobado` con `mp_status` `partially_refunded` y el pedido pasa a `CONFIRMADO` con actor Sistema

#### Scenario: Reembolso parcial de un pago ya aprobado
- **WHEN** llega una notificación firmada de una orden cuyo pago local está `aprobado` y MercadoPago ahora informa `partially_refunded`
- **THEN** responde 200 `already_processed` y ni el pago local ni el pedido cambian

### Requirement: Códigos de respuesta del webhook
Con firma válida, el webhook SHALL responder 200 cuando procesa, ignora o deduplica una notificación y ante una falla de negocio conocida (sin stock, pedido que el Sistema no puede confirmar o monto distinto). El cuerpo de toda respuesta 200 SHALL ser exactamente `{"status": <valor>}` con `processed`, `already_processed` o `ignored`, sin datos del pago ni del pedido. SHALL responder 502 `HTTP_502` si la consulta de la orden a MercadoPago falla por red, 5xx o respuesta inesperada, 503 `HTTP_503` si MercadoPago rechaza las credenciales, y 500 `INTERNAL_ERROR` ante cualquier otra falla inesperada, sin dejar cambios. Nunca SHALL responder 2xx a un error inesperado.

#### Scenario: MercadoPago no responde
- **WHEN** llega una notificación firmada y la consulta de la orden a MercadoPago devuelve un estado 5xx
- **THEN** recibe 502 con `code` `HTTP_502` y ningún pago ni pedido cambia

#### Scenario: Sin stock no hace reintentar
- **WHEN** llega la notificación firmada de la orden `processed` de un pedido `MERCADOPAGO` en `PENDIENTE` cuyo producto ya no tiene stock
- **THEN** recibe 200, el pedido queda en `CANCELADO` con motivo «Sin stock» y el pago local `a_devolver`

#### Scenario: Estado de MercadoPago desconocido
- **WHEN** llega una notificación firmada de una orden que MercadoPago informa con un estado no mapeado
- **THEN** recibe 200 con `status` `ignored` y nada cambia

#### Scenario: Cuerpo de una notificación que confirma el pedido
- **WHEN** llega la notificación firmada de la orden `processed` de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente
- **THEN** recibe 200 con el cuerpo exactamente `{"status": "processed"}` (sin `pago_id` ni datos del pedido) y el pedido pasa a `CONFIRMADO`

#### Scenario: Cuerpo de una reentrega
- **WHEN** MercadoPago reentrega esa misma notificación
- **THEN** recibe 200 con el cuerpo exactamente `{"status": "already_processed"}`

#### Scenario: Cuerpo de una notificación sin pago local
- **WHEN** llega una notificación firmada de una orden `processed` cuyo id y cuya referencia externa no corresponden a ningún pago local
- **THEN** recibe 200 con el cuerpo exactamente `{"status": "ignored"}`

#### Scenario: El aviso en tiempo real no depende del cuerpo
- **WHEN** el webhook confirma un pedido `MERCADOPAGO`
- **THEN** se emite el evento `PEDIDO_CONFIRMADO` a las salas del pedido y de cocina aunque el cuerpo de la respuesta no incluya el pedido

## ADDED Requirements

### Requirement: Id en minúsculas en el manifest de la firma
Como `data.id` es el id alfanumérico de una orden de MercadoPago, el manifest SHALL calcularse con `data.id` en minúsculas, que es como firma MercadoPago. Un `v1` calculado sobre el `data.id` tal como llegó en la query, si difiere de su versión en minúsculas, SHALL rechazarse como firma inválida. *(Supone la opción recomendada de OQ-2, condicionada a la confirmación en sandbox.)*

#### Scenario: Firma con el id en minúsculas
- **WHEN** llega una notificación `type=order` con `data.id=ORD01ABC` en la query, `x-request-id` `abc` y un `v1` calculado con la clave configurada sobre `id:ord01abc;request-id:abc;ts:1742505638683;`
- **THEN** la firma se acepta (no 401)

#### Scenario: Firma con el id tal como llegó
- **WHEN** llega la misma notificación con un `v1` calculado con la clave configurada sobre `id:ORD01ABC;request-id:abc;ts:1742505638683;`
- **THEN** recibe 401 con `code` `HTTP_401`, no se consulta a MercadoPago y ningún pago ni pedido cambia

#### Scenario: Id que ya viene en minúsculas
- **WHEN** llega una notificación `type=order` con `data.id=ord01abc` y un `v1` calculado sobre `id:ord01abc;request-id:abc;ts:1742505638683;`
- **THEN** la firma se acepta (no 401)

### Requirement: El webhook no bloquea el event loop
El procesamiento de una notificación del webhook (consulta de la orden a MercadoPago y acceso a la base) SHALL ejecutarse fuera del event loop del servidor, de modo que una consulta lenta a MercadoPago no demore otras peticiones.

#### Scenario: Consulta de la orden fuera del event loop
- **WHEN** llega una notificación `type=order` firmada y el backend consulta la orden a MercadoPago
- **THEN** la consulta se ejecuta en un hilo sin event loop en curso y la notificación se procesa con el mismo resultado (200 `processed`)

#### Scenario: Otra petición durante una consulta lenta
- **WHEN** la consulta de la orden de una notificación tarda y mientras tanto llega `GET /health`
- **THEN** `GET /health` responde sin esperar a que termine la consulta de la orden

### Requirement: Control del monto antes de confirmar
Antes de confirmar un pedido por un pago `aprobado` (en el webhook y en la creación sincrónica), el `total_amount` que MercadoPago informa para la orden SHALL ser igual, al centavo, al monto del intento de pago local. Si difiere o falta, el pedido, su historial y el stock no SHALL cambiar, el pago local SHALL quedar `a_devolver` con el id y el estado de MercadoPago registrados y el webhook SHALL responder 200. *(Supone la opción recomendada de OQ-3.)*

#### Scenario: Monto igual
- **WHEN** llega la notificación firmada de la orden `processed` con `total_amount` `"1500.00"` del pago local de $1500.00 de un pedido `MERCADOPAGO` en `PENDIENTE` con stock suficiente
- **THEN** responde 200 `processed`, el pago local queda `aprobado` y el pedido pasa a `CONFIRMADO`

#### Scenario: Monto distinto en el webhook
- **WHEN** llega la notificación firmada de la orden `processed` con `total_amount` `"1.00"` del pago local de $1500.00 de un pedido `MERCADOPAGO` en `PENDIENTE`
- **THEN** responde 200 `processed`; el pago local queda `a_devolver` con `mp_order_id` y `mp_status` `processed`; el pedido sigue en `PENDIENTE` sin filas nuevas de historial y el stock no cambia

#### Scenario: Orden sin monto
- **WHEN** MercadoPago informa la orden `processed` sin `total_amount`
- **THEN** el pago local queda `a_devolver` y el pedido sigue en `PENDIENTE`

#### Scenario: Monto distinto en la creación
- **WHEN** el cliente crea el pago de su pedido de $1500.00 y MercadoPago responde la orden `processed` con `total_amount` `"1499.99"`
- **THEN** recibe 201 con `estado` `a_devolver`; el pedido sigue en `PENDIENTE` y el stock no cambia

#### Scenario: Rechazo con monto distinto
- **WHEN** MercadoPago informa la orden `failed` con un `total_amount` distinto del monto local
- **THEN** el pago local queda `rechazado` (el monto solo se controla para confirmar)

#### Scenario: Reintento tras un monto distinto
- **WHEN** el pago local de un pedido quedó `a_devolver` por monto distinto y el cliente intenta crear otro pago de ese pedido
- **THEN** recibe 409 con `code` `PAYMENT_NOT_ALLOWED` y no se contacta a MercadoPago

### Requirement: Los logs de pagos no contienen secretos
Ningún registro de log emitido al atender `POST /api/v1/pagos/crear` o `POST /api/v1/pagos/webhook`, en cualquier nivel y en sus caminos de éxito o de error, SHALL contener el access token de MercadoPago, la clave secreta del webhook, el token de la tarjeta ni el hash `v1` del header `x-signature`.

#### Scenario: Errores al crear el pago
- **WHEN** con el log en nivel DEBUG se crea un pago y MercadoPago falla por red, responde 401 a las credenciales o responde 500
- **THEN** se registra al menos un aviso y ningún registro contiene el access token configurado ni el token de la tarjeta enviado

#### Scenario: Firma inválida en el webhook
- **WHEN** con el log en nivel DEBUG llega una notificación firmada con otra clave
- **THEN** se registra el aviso de firma inválida con el `x-request-id` y ningún registro contiene la clave secreta configurada ni el hash `v1` recibido

#### Scenario: Errores al consultar la orden
- **WHEN** con el log en nivel DEBUG llega una notificación firmada y MercadoPago responde 401 o 500 al consultar la orden
- **THEN** ningún registro contiene el access token ni la clave secreta configurados

#### Scenario: Monto distinto
- **WHEN** con el log en nivel DEBUG se procesa una orden `processed` con monto distinto
- **THEN** se registra un aviso con el id del pago local y ambos montos, sin el access token, la clave secreta ni datos de la tarjeta

## REMOVED Requirements

### Requirement: Variantes del id en el manifest de la firma
**Reason**: MercadoPago firma las notificaciones `order` con `data.id` en minúsculas (observado en sandbox, OQ-13 de C-12; a confirmar en el bloque manual de este change, OQ-2). Aceptar además el id tal como llegó era una precaución que ya no hace falta.
**Migration**: Reemplazado por «Id en minúsculas en el manifest de la firma». MercadoPago no requiere cambios; un emisor que firme con el id tal cual recibe 401.
