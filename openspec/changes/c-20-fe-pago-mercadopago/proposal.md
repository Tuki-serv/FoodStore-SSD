# Proposal — C-20 `fe-pago-mercadopago`

## Why

US-024..US-026 (Épica 6) piden que el cliente pague con tarjeta el pedido `MERCADOPAGO` que acaba de crear, vea el resultado (aprobado, rechazado con reintento, pendiente) y que la confirmación por webhook se refleje en la UI. Hoy C-19 deja al cliente en `/finalizar-compra/pedido/:pedidoId/pago`, una **página provisoria** (`PlaceholderPage`, dueño `C-20`): el pedido queda `PENDIENTE` para siempre. El backend de cobro (C-12, Orders API, DD-26) ya está cerrado y probado en sandbox; falta el frontend. C-20 está en el camino crítico (`… → C-19 → C-20 → C-25b`).

Observado en el repo (`dev`, 2026-11-19):

- **Backend** `POST /api/v1/pagos/crear` (propietario o ADMIN, 201): body `{pedido_id, token, payment_method_id, payment_type_id: "credit_card"|"debit_card", installments>=1, issuer_id?, payer{email, identification?{type, number}}}` con `extra="forbid"` (número/CVV/vencimiento → 422). Respuesta `{pago_id, pedido_id, estado, mp_order_id, mp_payment_id, mp_status, mp_status_detail}`; `estado` local ∈ `pendiente|aprobado|rechazado|a_devolver`; `mp_payment_id` es **texto** (`PAY…`). Errores: 409 `PAYMENT_NOT_ALLOWED` (no es `MERCADOPAGO`, no está `PENDIENTE`, ya pagado o en proceso), 400 `HTTP_400` (datos rechazados por MercadoPago, intento `rechazado`), 502 `HTTP_502` (resultado desconocido, intento reutilizable), 503 `HTTP_503` (sin credenciales o credenciales rechazadas), 403/404.
- `GET /api/v1/pagos/{pedido_id}` → `{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (todo `null` salvo `pedido_id` si no hubo intentos).
- **Frontend**: `paymentStore` (`@/entities/payment`, C-13b) solo en memoria con `mpPaymentId: number` (desactualizado: el id es texto desde DD-26) y sin `a_devolver`. `@mercadopago/sdk-react` **no está instalado**. La configuración (`shared/config/env.ts`) solo lee `VITE_API_URL`; el backend tiene `MP_PUBLIC_KEY` en `config.py` pero **ningún endpoint la expone**.
- `pedidoQueries.detalle(id)` ya trae `total` y `estado_codigo`; el carrito ya está vacío al llegar al pago (OQ-3 de C-19).

## What Changes

- **Página de pago** en `/finalizar-compra/pedido/:pedidoId/pago` (reemplaza la provisoria, misma ruta y guarda `CLIENT`): resumen del pedido (número, total) y el brick `CardPayment` de `@mercadopago/sdk-react` (tokenización en el navegador, PCI SAQ-A, DD-21: sin redirect a Checkout Pro).
- **Envío del pago**: del `onSubmit` del brick se arma `CrearPagoRequest` con solo los campos permitidos (incluye `payment_type_id` de `additionalData.paymentTypeId`) y se llama `POST /pagos/crear` con una mutación de TanStack Query.
- **Vista según el estado real** (server state): la página decide qué mostrar a partir de `GET /pedidos/{id}` + `GET /pagos/{pedido_id}`, así una recarga muestra lo correcto:
  - **Aprobado**: «¡Pago aprobado!», pedido `CONFIRMADO`; invalida `pedidoQueries.detalle(id)` y `pedidoQueries.todas()`.
  - **Rechazado**: motivo legible a partir de `mp_status_detail` y **reintento** sobre el mismo pedido (el brick se vuelve a montar).
  - **Pendiente**: «Estamos esperando la confirmación de Mercado Pago» con **polling** de `GET /pagos/{pedido_id}` hasta un estado terminal o un tope de tiempo (US-025).
  - **Aprobado pero pedido cancelado por falta de stock** (DD-20, pago `a_devolver`): explicación y que la devolución se gestiona a mano (PA-08).
  - **No corresponde pagar**: pedido no `MERCADOPAGO`, ya `CONFIRMADO`/avanzado o `CANCELADO` → mensaje y enlace a la confirmación del pedido; pedido inexistente → «No encontramos este pedido».
  - **Errores**: 409 (ya no se puede pagar), 502 (resultado desconocido, «Reintentar» reutiliza el intento en el backend), 503 («El pago con tarjeta no está disponible»), red caída.
- **Configuración**: nueva variable `VITE_MP_PUBLIC_KEY` (clave **pública** de MercadoPago, no secreta) en `frontend/.env.example`; si falta, la página de pago muestra «El pago con tarjeta no está disponible» sin romper el resto de la app (ver OQ-1).
- **Store de pago**: `mpPaymentId` pasa a `string`, se agrega `a_devolver` al resultado; el store sigue solo en memoria y no guarda datos de tarjeta.
- **Dependencia nueva**: `@mercadopago/sdk-react` (versión exacta fijada en apply).
- **Sin cambios de backend** (salvo que OQ-1 elija exponer la clave pública por endpoint).

### Partición propuesta (confirmada por el usuario el 2026-11-19, OQ-5)

El scope entra en un solo change de tamaño similar a C-19. Si preferís partirlo, el corte limpio es:

- **C-20 parte A** — página de pago con el brick, envío, resultado inmediato de `crear` (aprobado / rechazado + reintento / pendiente estático / `a_devolver`) y errores 409/502/503.
- **C-20 parte B** — reflejo del webhook: polling de `GET /pagos/{pedido_id}` en «pendiente», recarga de la página que reconstruye el estado desde el servidor y el estado de pago con `mp_status_detail` en la confirmación del pedido.

Las tareas están ordenadas para que el corte sea por bloque, sin reescribir nada. Por defecto se propone **un solo change**; no se renumera `CHANGES.md`.

## Capabilities

### New Capabilities
- `frontend-payment`: pago con tarjeta de un pedido en el frontend: acceso, brick `CardPayment`, envío sin datos de tarjeta, vistas de resultado (aprobado, rechazado + reintento, pendiente con polling, `a_devolver`), casos donde no corresponde pagar, errores y accesibilidad.

### Modified Capabilities
- `frontend-checkout`: el requisito «Traspaso al pago con tarjeta» deja de mostrar la página provisoria; la ruta lleva a la página de pago real.
- `frontend-foundation`: el requisito «Configuración explícita por variables `VITE_*`» incorpora `VITE_MP_PUBLIC_KEY` como variable opcional que solo condiciona el pago con tarjeta.
- `frontend-client-stores`: el requisito «Estado del pago no persistente» precisa que el identificador de MercadoPago es texto y que el resultado puede ser `a_devolver`.

## Impact

- **Governance CRÍTICO** (pagos): solo propuesta; no se escribe código sin el OK explícito del usuario. Gate visual `[UI-MOCKUP]`: mockups aprobados antes de apply.
- **Frontend**: `src/entities/payment/` (api + model + tipos), `src/features/pagar-con-tarjeta/` (envoltorio del brick), `src/pages/pago-pedido/` (nueva), `src/app/router/routes.tsx` (reemplaza `PlaceholderPage` en `RUTA_PAGO_PEDIDO`), `src/shared/config/env.ts`, `src/vite-env.d.ts`, `frontend/.env.example`, `package.json`/lock (`@mercadopago/sdk-react`).
- **Backend**: sin cambios (contrato de C-12).
- **Secretos**: ninguno en el frontend. `VITE_MP_PUBLIC_KEY` es la clave pública (va al navegador por diseño); el access token (`MP_ACCESS_TOKEN`) y `MP_WEBHOOK_SECRET` siguen solo en el backend.
- **Pruebas**: Vitest + RTL + MSW; el brick (SDK de terceros que carga un iframe/script de MercadoPago) se reemplaza en tests con `vi.mock('@mercadopago/sdk-react')`. Prueba manual en sandbox (tarjetas `APRO`/`FUND`/`OTHE`/`CONT`) en verify, con el backend y ngrok del usuario.
