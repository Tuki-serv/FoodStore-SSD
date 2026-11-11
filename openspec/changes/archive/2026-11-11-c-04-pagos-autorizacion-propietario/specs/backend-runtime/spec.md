# Spec Delta

## MODIFIED Requirements

### Requirement: Pagos sin MercadoPago configurado
Si falta alguna variable del grupo de pagos que necesita la operación invocada, esa operación SHALL responder 503 en el formato de error de la API, con un `detail` que diga que MercadoPago no está configurado y nombre la variable faltante, sin contactar a MercadoPago. Crear un pago usa `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL` y `BACKEND_PUBLIC_URL`. El redirect post-pago usa `FRONTEND_URL`. En crear un pago, el 503 SHALL evaluarse solo después de la autenticación y del acceso al pedido (`payment-api`): quien no tiene acceso recibe 401, 403 o 404, nunca 503.

#### Scenario: Crear pago sin token
- **WHEN** el propietario autenticado de un pedido existente solicita crear su pago y `MP_ACCESS_TOKEN` no está definida
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que indica que MercadoPago no está configurado y menciona `MP_ACCESS_TOKEN`

#### Scenario: Crear pago sin URL de notificación
- **WHEN** el propietario autenticado de un pedido existente solicita crear su pago con `MP_ACCESS_TOKEN` definida y sin `MP_NOTIFICATION_URL`
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que menciona `MP_NOTIFICATION_URL`

#### Scenario: Usuario sin acceso y MercadoPago sin configurar
- **WHEN** `MP_ACCESS_TOKEN` no está definida y un cliente que no es el dueño del pedido solicita crear su pago
- **THEN** recibe 403 y no se informa nada sobre la configuración de MercadoPago

#### Scenario: Redirect sin FRONTEND_URL
- **WHEN** llega un `GET /api/v1/pagos/redirect/{pedido_id}/{status}` y `FRONTEND_URL` no está definida
- **THEN** recibe 503 con `code` `HTTP_503` y un `detail` que indica que `FRONTEND_URL` no está configurada
