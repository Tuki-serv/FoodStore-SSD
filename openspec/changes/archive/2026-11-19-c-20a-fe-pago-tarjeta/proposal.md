# Proposal — C-20a `fe-pago-tarjeta`

> Parte A de C-20 (`fe-pago-mercadopago`), partido por decisión del usuario el 2026-11-19 (OQ-5 = partir). La parte B es C-20b `fe-pago-seguimiento` (polling del pendiente, reconstrucción del estado al recargar y estado del pago en la confirmación), que depende de este change.

## Why

US-024 (Épica 6) pide que el cliente pague con tarjeta el pedido `MERCADOPAGO` que acaba de crear y vea el resultado (aprobado o rechazado con reintento). Hoy C-19 deja al cliente en `/finalizar-compra/pedido/:pedidoId/pago`, una **página provisoria** (`PlaceholderPage`, dueño `C-20`): el pedido queda `PENDIENTE` para siempre. El backend de cobro (C-12, Orders API, DD-26) ya está cerrado y probado en sandbox; falta el frontend. C-20a está en el camino crítico (`… → C-19 → C-20a → C-20b → C-25b`).

Observado en el repo (`dev`, 2026-11-19):

- **Backend** `POST /api/v1/pagos/crear` (propietario o ADMIN, 201): body `{pedido_id, token, payment_method_id, payment_type_id: "credit_card"|"debit_card", installments>=1, issuer_id?, payer{email, identification?{type, number}}}` con `extra="forbid"` (número/CVV/vencimiento → 422). Respuesta `{pago_id, pedido_id, estado, mp_order_id, mp_payment_id, mp_status, mp_status_detail}`; `estado` local ∈ `pendiente|aprobado|rechazado|a_devolver`; `mp_payment_id` es **texto** (`PAY…`). Errores: 409 `PAYMENT_NOT_ALLOWED` (no es `MERCADOPAGO`, no está `PENDIENTE`, ya pagado o en proceso), 400 `HTTP_400` (datos rechazados por MercadoPago, intento `rechazado`), 502 `HTTP_502` (resultado desconocido, intento reutilizable), 503 `HTTP_503` (sin credenciales o credenciales rechazadas), 403/404.
- `GET /api/v1/pagos/{pedido_id}` → `{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (todo `null` salvo `pedido_id` si no hubo intentos). En C-20a solo se usa tras un 409; la consulta al montar la página es de C-20b.
- **Frontend**: `paymentStore` (`@/entities/payment`, C-13b) solo en memoria con `mpPaymentId: number` (desactualizado: el id es texto desde DD-26) y sin `a_devolver`. `@mercadopago/sdk-react` **no está instalado**. La configuración (`shared/config/env.ts`) solo lee `VITE_API_URL`; el backend tiene `MP_PUBLIC_KEY` (opcional) en `config.py` pero **ningún endpoint la expone**.
- **Spec `payment-api`**: «Crear y consultar un pago exige autenticación» y «Rutas públicas de pagos» (el webhook es la única ruta pública); la matriz RBAC ejecutable (`tests/support/rbac_matriz.py`) tiene una fila por endpoint.
- `pedidoQueries.detalle(id)` ya trae `total`, `forma_pago_codigo` y `estado_codigo`; el carrito ya está vacío al llegar al pago (OQ-3 de C-19).

## What Changes

- **Página de pago** en `/finalizar-compra/pedido/:pedidoId/pago` (reemplaza la provisoria, misma ruta y guarda `CLIENT`): resumen del pedido (número, total) y el brick `CardPayment` de `@mercadopago/sdk-react` (tokenización en el navegador, PCI SAQ-A, DD-21: sin redirect a Checkout Pro).
- **Envío del pago**: del `onSubmit` del brick se arma `CrearPagoRequest` con solo los campos permitidos (incluye `payment_type_id` de `additionalData.paymentTypeId`) y se llama `POST /pagos/crear` con una mutación de TanStack Query.
- **Resultado inmediato** (respuesta de `crear`, escrita en la caché de TanStack Query):
  - **Aprobado**: «¡Pago aprobado!», pedido `CONFIRMADO`; invalida `pedidoQueries.detalle(id)` y `pedidoQueries.todas()`.
  - **Rechazado**: motivo legible a partir de `mp_status_detail` y **reintento** sobre el mismo pedido (el brick se vuelve a montar).
  - **Pendiente** (estático): «Estamos esperando la confirmación de Mercado Pago» con «Ver mi pedido», sin formulario. El seguimiento automático (polling) es de C-20b.
  - **Aprobado pero pedido cancelado por falta de stock** (DD-20, pago `a_devolver`): explicación y que la devolución se gestiona a mano (PA-08).
- **No corresponde pagar** (a partir del pedido): pedido no `MERCADOPAGO`, ya `CONFIRMADO`/avanzado o `CANCELADO` → mensaje y enlace a la confirmación del pedido; pedido inexistente → «No encontramos este pedido».
- **Errores**: 409 (vuelve a pedir pedido y pago y muestra la vista que corresponda), 400, 502 (resultado desconocido, «Reintentar» reutiliza el intento en el backend), 503 («El pago con tarjeta no está disponible»), red caída.
- **Clave pública desde el backend (OQ-1 = endpoint, 2026-11-19)**: nuevo endpoint de solo lectura `GET /api/v1/pagos/config` que devuelve `{public_key}` con la `MP_PUBLIC_KEY` ya definida en `backend/app/core/config.py`. Exige un access token Bearer de un usuario activo (sin restricción de rol) y responde 503 `HTTP_503` si la clave no está configurada. Sigue las capas (`PaymentService.obtener_configuracion_publica()`; el router solo delega) y se prueba con pytest (TDD) contra la base de tests. El frontend la pide con TanStack Query al montar el formulario; si responde 503 (o falla), la página muestra «El pago con tarjeta no está disponible en este momento» sin romper el resto de la app. **No** se agrega ninguna variable `VITE_*`.
- **Store de pago**: `mpPaymentId` pasa a `string`, se agrega `a_devolver` al resultado; el store sigue solo en memoria y no guarda datos de tarjeta.
- **Dependencia nueva**: `@mercadopago/sdk-react` (versión exacta fijada en apply).
- **Backend**: solo el endpoint de la clave pública; el contrato de cobro de C-12 no cambia.

**Fuera de C-20a (van a C-20b)**: polling de `GET /pagos/{pedido_id}` mientras el pago está pendiente y su tope de espera; consulta del último intento al montar la página (recarga que reconstruye «aprobado», «rechazado con motivo» o «pendiente»); línea de estado del pago en la confirmación del pedido (US-025, US-026). Hasta C-20b, recargar la página con un pago ya aprobado muestra «Este pedido ya no se puede pagar» (el pedido ya no está `PENDIENTE`) y tras un rechazo vuelve al formulario sin el motivo.

## Capabilities

### New Capabilities
- `frontend-payment`: pago con tarjeta de un pedido en el frontend: acceso, brick `CardPayment`, envío sin datos de tarjeta, resultado inmediato (aprobado, rechazado + reintento, pendiente, `a_devolver`), casos donde no corresponde pagar, errores y accesibilidad.

### Modified Capabilities
- `payment-api`: se agrega el requisito «Configuración pública de pagos» (`GET /api/v1/pagos/config`, autenticado, 503 sin clave). Las rutas públicas de pagos no cambian (el webhook sigue siendo la única).
- `frontend-checkout`: el requisito «Traspaso al pago con tarjeta» deja de mostrar la página provisoria; la ruta lleva a la página de pago real.
- `frontend-client-stores`: el requisito «Estado del pago no persistente» precisa que el identificador de MercadoPago es texto y que el resultado puede ser `a_devolver`.

## Impact

- **Governance CRÍTICO** (pagos): solo propuesta; no se escribe código sin el OK explícito del usuario. Gate visual `[UI-MOCKUP]`: mockups aprobados antes de apply.
- **Frontend**: `src/entities/payment/` (api + model + tipos), `src/features/pagar-con-tarjeta/` (envoltorio del brick), `src/pages/pago-pedido/` (nueva), `src/app/router/routes.tsx` (reemplaza `PlaceholderPage` en `RUTA_PAGO_PEDIDO`), `package.json`/lock (`@mercadopago/sdk-react`). `shared/config/env.ts` no cambia.
- **Backend**: `app/modules/pagos/` (`schemas.py`: `ConfiguracionPagosResponse`; `service.py`: `obtener_configuracion_publica`; `router.py`: `GET /config`, declarado antes de `GET /{pedido_id}`), `tests/integration/` (test nuevo del endpoint) y `tests/support/rbac_matriz.py` (fila `GET /api/v1/pagos/config` `AUTENTICADO`). Sin migraciones.
- **Secretos**: ninguno en el frontend. La clave pública viaja al navegador por diseño (no es secreta); el endpoint nunca expone `MP_ACCESS_TOKEN` ni `MP_WEBHOOK_SECRET`.
- **Pruebas**: pytest (endpoint de configuración, PostgreSQL de tests) y Vitest + RTL + MSW; el brick (SDK de terceros que carga un iframe/script de MercadoPago) se reemplaza en tests con `vi.mock('@mercadopago/sdk-react')`. Prueba manual en sandbox (tarjetas `APRO`/`FUND`/`OTHE`/`CONT`) en verify, con el backend y ngrok del usuario.
- **Habilita** C-20b `fe-pago-seguimiento`.
