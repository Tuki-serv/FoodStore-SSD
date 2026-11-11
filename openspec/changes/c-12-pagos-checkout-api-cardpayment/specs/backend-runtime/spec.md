## MODIFIED Requirements

### Requirement: Pagos sin MercadoPago configurado
Si falta una variable de pagos que la operación necesita (crear pago: `MP_ACCESS_TOKEN` y `MP_NOTIFICATION_URL`), SHALL responder 503 en el formato de error de la API (`{detail, code, field}`, `code` `HTTP_503`), nombrando todas las variables faltantes, sin crear pagos y sin contactar a MercadoPago. Al crear un pago, el 503 SHALL evaluarse después de la autenticación, del acceso al pedido y de las precondiciones de cobro (`payment-api`): sin acceso es 401, 403 o 404, y un pedido que no se puede cobrar es 409.

#### Scenario: Crear pago sin token
- **WHEN** el propietario autenticado de un pedido `MERCADOPAGO` en `PENDIENTE` solicita crear su pago y `MP_ACCESS_TOKEN` no está definida
- **THEN** recibe 503 con `code` `HTTP_503`, `field` nulo y un `detail` que indica que MercadoPago no está configurado y menciona `MP_ACCESS_TOKEN`; no se crea ninguna fila en `pagos`

#### Scenario: Crear pago sin URL de notificación
- **WHEN** el propietario autenticado de un pedido `MERCADOPAGO` en `PENDIENTE` solicita crear su pago con `MP_ACCESS_TOKEN` definida y sin `MP_NOTIFICATION_URL`
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que menciona `MP_NOTIFICATION_URL`

#### Scenario: Faltan ambas
- **WHEN** el propietario solicita crear su pago sin `MP_ACCESS_TOKEN` ni `MP_NOTIFICATION_URL`
- **THEN** recibe 503 con un `detail` que menciona las dos variables

#### Scenario: Redirect sin FRONTEND_URL
- **WHEN** llega un `GET /api/v1/pagos/redirect/{pedido_id}/{status}` (ruta de Checkout Pro, retirada junto con `FRONTEND_URL`)
- **THEN** recibe 404 con `code` `HTTP_404`, no 503

#### Scenario: Usuario sin acceso y MercadoPago sin configurar
- **WHEN** `MP_ACCESS_TOKEN` no está definida y un cliente que no es el dueño del pedido solicita crear su pago
- **THEN** recibe 403 y no se informa nada sobre la configuración de MercadoPago
