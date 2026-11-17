# Proposal — C-12 `pagos-checkout-api-cardpayment`

## Why

El cobro con MercadoPago sigue siendo **Checkout Pro** (preferencia + redirect a `init_point`): el cliente sale del sitio para pagar, el backend arma `back_urls` y un endpoint público de redirect, y `pagos.external_reference` es el id numérico del pedido, nullable y sin unicidad. La spec `[INT]` (DD-07) pide **Checkout API con token de tarjeta** (`CardPayment` brick, PCI DSS SAQ-A, sin salir del sitio), `X-Idempotency-Key` en la creación y `external_reference` UUID único (DT-01, DT-26). El usuario resolvió PA-05 (DD-21): se migra directo, sin Checkout Pro como etapa intermedia ni alternativa de redirect. Con C-04 (autorización) y C-05 (webhook firmado, idempotente y transaccional) archivados, es el último change de pagos de Fase 0 y bloquea el checkout del frontend (C-20).

Observado en el código (`dev`, 2026-11-11, después de C-05 y C-09/C-10/C-11):

- `PaymentService.crear_pago` exige `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL` y `BACKEND_PUBLIC_URL` (503 vía `HTTPException`), crea una preferencia con `float(monto)` y `external_reference = str(pedido_id)`, y guarda `Pago(pendiente, mp_preference_id, mp_init_point, idempotency_key=uuid4)` **después** de llamar a MercadoPago. No valida forma de pago ni estado del pedido ni que ya exista un pago aprobado.
- `router.mp_redirect` (`GET /pagos/redirect/{pedido_id}/{status}`) redirige a `FRONTEND_URL`; es la única lectura de `FRONTEND_URL`. `BACKEND_PUBLIC_URL` solo arma las `back_urls`.
- El webhook (C-05) resuelve el pago local por `mp_payment_id` → `int(external_reference)` como **id de pedido** (último pago del pedido) → `merchant_order_id`.
- `GET /pagos/{pedido_id}` devuelve solo `{estado, pedido_id}`.
- SDK `mercadopago` 3.6.0 instalado: `sdk.payment().create(datos, request_options)`; si no se pasa `x-idempotency-key` en `custom_headers`, el SDK genera uno **aleatorio por llamada**. También trae `sdk.order()` (Orders API).
- Migraciones: cabeza vigente `002`. `pagos.external_reference` es `VARCHAR(100) NULL` sin `UNIQUE`; `idempotency_key` y `mp_payment_id` ya son `UNIQUE`.

### Revisión 2026-11-15 — por qué se pasa a la Orders API

La implementación sobre el recurso Payments (D1) quedó completa (tareas 0–9), pero la verificación manual en sandbox (tarea 10.2, 2026-11-15, credenciales de prueba del vendedor del usuario, prefijo `APP_USR-`, cuenta marcada `test_user`) mostró que **con esa cuenta el cobro con tarjeta en modo prueba solo funciona por la Orders API** (detalle en `design.md` §«Hallazgos del sandbox (2026-11-15)»):

- Todo `POST /v1/payments` respondió **401 «Unauthorized use of live credentials»** (causa `7`), sin importar el email del pagador, el token (válido del brick o inválido) ni `notification_url`. Los tres intentos reales por el backend quedaron `rechazado` con causa `7` y el backend respondió 400 «MercadoPago rechazó los datos del pago», un mensaje **engañoso**: era un problema de credenciales, no de la tarjeta.
- Con el mismo access token, `GET /v1/payment_methods` (200), `GET /v1/payments/search` (200), `POST /checkout/preferences` (201) y `POST /v1/orders` **pasan la autorización**: con un token falso de 32 caracteres, `/v1/orders` respondió 402 con una orden de prueba creada (`ORDTST…`, `status: failed`, transacción `invalid_card_token`).
- El panel de la aplicación no ofrece «Activar credenciales». La documentación oficial de migración equipara el 401 «Unauthorized use of live credentials» de Payments con `invalid_credentials` de Orders y presenta Orders como reemplazo de Payments para Checkout API; el SDK ya avisaba la deprecación de `notification_url` por pago (D10).

## What Changes

- **BREAKING — `POST /api/v1/pagos/crear` cobra con token de tarjeta (Checkout API, recurso Payments):** recibe `{pedido_id, token, payment_method_id, installments, issuer_id?, payer: {email, identification?}}` (lo que entrega el brick `CardPayment`; nunca número, CVV ni vencimiento) y crea el pago en MercadoPago de forma sincrónica con `X-Idempotency-Key` igual al `idempotency_key` UUID del pago local. Responde 201 con `{pago_id, pedido_id, estado, mp_payment_id, mp_status, mp_status_detail}`. Desaparecen `preference_id`, `init_point` y `public_key` de la respuesta.
- **Precondiciones de negocio nuevas** (409 `PAYMENT_NOT_ALLOWED`): el pedido debe ser `MERCADOPAGO` y estar en `PENDIENTE`, y no debe tener un pago `aprobado`, `a_devolver` o en proceso en MercadoPago. Se evalúan después de 401/404/403 y antes del 503 de configuración.
- **Resultado sincrónico:** un pago `rejected` responde 201 con `estado` `rechazado` y `mp_status_detail` (el pedido sigue `PENDIENTE`); un pago `approved` confirma el pedido en la misma transacción que el webhook usaría (actor Sistema, stock, historial; sin stock → `CANCELADO` y pago `a_devolver`); `in_process`/`pending` queda `pendiente` hasta el webhook.
- **Reintento tras rechazo:** con el último pago `rechazado`, un nuevo `POST /pagos/crear` crea **otro** pago local (nuevo `idempotency_key` y `external_reference`). Si el último intento quedó con resultado **desconocido** (falla de red/5xx de MercadoPago, sin `mp_payment_id`), el reintento **reutiliza** ese pago local y su `idempotency_key`, para que MercadoPago no cobre dos veces.
- **Errores de MercadoPago al crear:** datos rechazados por MercadoPago (4xx, p. ej. token inválido o usado) → 400 `HTTP_400` y el intento queda `rechazado`; falla de red o 5xx → 502 `HTTP_502` y el intento queda `pendiente` sin `mp_payment_id` (reintento seguro). El monto se envía redondeado a 2 decimales desde `Decimal`.
- **`GET /api/v1/pagos/{pedido_id}`** agrega `pago_id`, `mp_status` y `mp_status_detail` del último intento.
- **DT-26 — `pagos.external_reference` UUID único y obligatorio**, generado por el backend por intento de pago, enviado a MercadoPago y usado por el webhook para asociar la notificación al intento (ya no al «último pago del pedido»). **Migración `003`** (siguiente a `002`): rellena las filas existentes, `NOT NULL`, `UNIQUE` con nombre explícito; además elimina `mp_preference_id` y `mp_init_point` (Checkout Pro). Reversible.
- **BREAKING — Se retira Checkout Pro:** se elimina `GET /api/v1/pagos/redirect/{pedido_id}/{status}` y las variables `FRONTEND_URL` y `BACKEND_PUBLIC_URL` (código, `.env.example`, README, specs). El 503 «MercadoPago no configurado» se conserva en el flujo nuevo, con el formato uniforme `{detail, code, field}`, nombrando `MP_ACCESS_TOKEN` y/o `MP_NOTIFICATION_URL`.
- El webhook de C-05 se mantiene como **confirmación** (firma, idempotencia, transacción única); solo cambia cómo encuentra el pago local por `external_reference`.
- `TARJETA` sigue deshabilitada en el catálogo: la tarjeta es un medio dentro de `MERCADOPAGO` (sin cambios en el seed).

### Revisión 2026-11-15 — cobro por la Orders API (`POST /v1/orders`)

Reemplaza D1 (Payments) por D16..D26 de `design.md`. **Gobernanza CRÍTICA: no se escribe código hasta que el usuario apruebe esta revisión y responda OQ-9..OQ-17.**

- **Se mantiene:** los endpoints públicos `POST /api/v1/pagos/crear`, `POST /api/v1/pagos/webhook` y `GET /api/v1/pagos/{pedido_id}`; PCI SAQ-A (solo token del brick `CardPayment`, `extra="forbid"`); las precondiciones (409 `PAYMENT_NOT_ALLOWED`) y su orden; T1 → MercadoPago → T2 (D4); el camino único de aplicación de estados (D7); `external_reference` UUID por intento (D9) y la reutilización del intento tras un resultado desconocido (D6); firma del webhook, idempotencia y transacción única (C-05).
- **Adaptador:** `pasarela_mp.py` sigue siendo el único módulo que conoce el SDK y pasa de `sdk.payment()` a `sdk.order()` (`create`, `get`, `search`), ya presentes en `mercadopago` 3.6.0 (sin dependencia nueva). Cuerpo de Orders: `type: online`, `processing_mode: automatic`, `total_amount` y `amount` como texto con 2 decimales (sin `float`), una transacción de pago con `payment_method {id, type, token, installments}`, `payer`, `external_reference`, `description`. Sin `notification_url` (no existe en Orders) ni `issuer_id` (sin campo documentado).
- **Contrato de `POST /pagos/crear` (BREAKING menor):** agrega `payment_type_id` obligatorio (`credit_card` | `debit_card`, lo da el brick en `additionalData.paymentTypeId`); `issuer_id` se sigue aceptando pero no se envía. La respuesta agrega `mp_order_id` y `mp_payment_id` pasa a ser texto (id de transacción `PAY…`). `mp_status`/`mp_status_detail` pasan a los valores de Orders (`processed`/`accredited`, `failed`/`insufficient_amount`, …).
- **Mapeo de estados** de la orden a los estados locales (`processed` → `aprobado`; `failed`/`canceled`/`refunded`/`charged_back` → `rechazado`; `created`/`processing`/`action_required` → `pendiente`). Un 402 de MercadoPago con orden `failed` es un **resultado** (201 `rechazado`), no un error.
- **Errores al crear, corregidos:** credenciales rechazadas por MercadoPago (401/403) → **503 `HTTP_503`** «MercadoPago rechazó las credenciales configuradas» (no más «rechazó los datos del pago»), con el intento reutilizable; 4xx de datos → 400 como hoy; 409 `idempotency_key_already_used` → se reconcilia buscando la orden por `external_reference`; 423/5xx/red → 502 como hoy.
- **Webhook:** tópico `order` (evento «Order (Mercado Pago)» configurado en el panel), `data.id` = id de la orden (alfanumérico), consulta `GET /v1/orders/{id}`, dedupe por id de orden; las notificaciones `payment`/`merchant_order` se ignoran (200 `ignored`).
- **OQ-3 resuelta:** Orders no admite `notification_url`; las notificaciones se configuran en el panel. **Se retira `MP_NOTIFICATION_URL`** (config, `.env.example`, `.env.test*`, README, specs) y el 503 de crear solo exige `MP_ACCESS_TOKEN`.
- **Migración `004`** (cabeza nueva): `pagos.mp_order_id VARCHAR(64)` único (`uq_pagos_mp_order_id`), `mp_payment_id` pasa de `BIGINT` a `VARCHAR(64)` (ids `PAY…`), se elimina `mp_merchant_order_id` (Orders no usa merchant orders). Reversible.
- `sandbox/pago-prueba.html` manda `payment_type_id`; `sandbox/README.md` y la tarea 10.2 cambian casos (titulares `APRO`/`OTHE`/`FUND`/`CONT`, webhook del panel).

**Fuera de alcance (con dueño):** pantalla de checkout con el brick (C-20, frontend); otros medios del Payment Brick (Rapipago/Pago Fácil/cuenta MP); 3DS / `action_required` con challenge (queda `pendiente`, OQ-16); reembolsos y reacción a `refunded`/`cancelled` `[PENDIENTE DE DECISIÓN: PA-08]`; sacar los `HTTPException` restantes de otros services (C-25a).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `payment-api`: el contrato de `POST /pagos/crear` (token de tarjeta, idempotencia, precondiciones, resultado sincrónico, reintento, errores de MercadoPago), el de `GET /pagos/{pedido_id}` (`mp_status_detail`), la asociación del webhook por `external_reference` y el retiro de la ruta de redirect de «Rutas públicas de pagos».
- `backend-config`: se retiran `BACKEND_PUBLIC_URL` y `FRONTEND_URL` (de las opcionales, del requisito «URLs explícitas del flujo de pago actual» y de los escenarios que las nombran); pasan a la lista de variables retiradas.
- `backend-runtime`: «Pagos sin MercadoPago configurado» deja de mencionar `BACKEND_PUBLIC_URL`, `FRONTEND_URL` y el redirect.
- `backend-db-migrations`: nueva migración `003` (referencia externa UUID única y obligatoria, retiro de columnas de Checkout Pro) que pasa a ser la cabeza.
- `api-conventions`: nuevo código de negocio `PAYMENT_NOT_ALLOWED` (409). (Sin cambios en la revisión 2026-11-15.)

Revisión 2026-11-15 (Orders API):
- `payment-api`: contrato de crear (`payment_type_id`, `mp_order_id`, ids de texto, valores de estado de Orders, 402 como resultado, credenciales rechazadas → 503, reconciliación tras `idempotency_key_already_used`) y webhook por tópico `order` (firma, id de orden, idempotencia por orden).
- `backend-config`: `MP_NOTIFICATION_URL` pasa a variables retiradas.
- `backend-runtime`: el 503 de crear solo nombra `MP_ACCESS_TOKEN`.
- `backend-db-migrations`: nueva migración `004` (`mp_order_id`, `mp_payment_id` texto, sin `mp_merchant_order_id`) que pasa a ser la cabeza.

## Impact

- **Código**: `modules/pagos/` — `schemas.py` (request/response nuevos), `service.py` (flujo Checkout API, precondiciones, reintento, aplicación de estado compartida con el webhook, 503 con `AppError`), adaptador nuevo del borde MercadoPago (`gateway_mp.py` o similar) para crear/consultar pagos, `repository.py` (`get_by_external_reference_for_update`), `router.py` (sin redirect), `models.py` (`external_reference` UUID NN, sin columnas de preferencia); `core/config.py` (sin `BACKEND_PUBLIC_URL`/`FRONTEND_URL`); `core/errors.py` (`PAYMENT_NOT_ALLOWED`); `alembic/versions/003_*.py`.
- **API**: cambios incompatibles en `POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}` (campos nuevos); `GET /api/v1/pagos/redirect/...` desaparece (404). El webhook mantiene su contrato.
- **Datos**: migración `003`; las filas de `pagos` existentes reciben un UUID nuevo en `external_reference` (su referencia numérica se pierde) y pierden `mp_preference_id`/`mp_init_point`.
- **Tests**: nuevo `tests/integration/test_pago_checkout_api.py` (aprobado, rechazado, pendiente, reintento, errores de MercadoPago, idempotencia) con el SDK mockeado en el borde; actualizar `test_pago_autorizacion.py`, `test_optional_integrations.py`, `test_pago.py`, `test_pago_webhook_*.py` (referencia UUID), `tests/support/mp_webhook.py` y `pagos_factory.py`, `tests/unit/test_config.py`, `test_env_example.py`/`settings_env.py`, `test_migrations.py` (cabeza `003`).
- **Config**: `backend/.env.example` sin `BACKEND_PUBLIC_URL` ni `FRONTEND_URL` (requiere autorización explícita para editarlo, como en C-05).
- **Docs**: `knowledge-base/11` (modalidades, flujo de cobro, riesgos), `07` (Flujo 4 pasos 5–7), `05` (RN-PA-01/02/03), `04` (`Pago`), `08` (variables), `09` (DT-01 y DT-26 resueltas), `backend/README.md` (variables), `CHANGES.md` (C-12 `[x]` al archivar).

**Impacto de la revisión 2026-11-15 (Orders API)** — tamaño estimado: ~11 archivos de producción y ~18 de tests.
- **Código**: `pagos/pasarela_mp.py` (reescrito sobre `sdk.order()`), `schemas.py` (`payment_type_id`, `mp_order_id`, ids de texto), `service.py` (mapeo de estados, 503 por credenciales, webhook `order`, 503 sin `MP_NOTIFICATION_URL`), `models.py`, `repository.py` (`get_by_mp_order_id_for_update`; fuera las lecturas por merchant order), `decision_cobro.py` y `decision_webhook.py` (id de orden de texto), `firma_webhook.py` (`data.id` en minúsculas, OQ-13), `core/config.py` (sin `MP_NOTIFICATION_URL`), `alembic/versions/004_*.py`.
- **API**: `POST /pagos/crear` exige `payment_type_id` y devuelve `mp_order_id`; `mp_payment_id` pasa a texto; valores de `mp_status` de Orders. El webhook espera notificaciones `order`.
- **Datos**: migración `004`; los `mp_payment_id` numéricos existentes se conservan como texto; `mp_merchant_order_id` se pierde.
- **Tests**: `tests/support/mp_webhook.py` (`MPFalso.order()` con `create`/`get`/`search`), `mp_firma`, `test_pasarela_mp.py`, `test_pago_checkout_api.py`, `test_pago_checkout_concurrente.py`, `test_pago_webhook_*.py`, `test_decision_cobro.py`, `test_decision_pago_webhook.py`, `test_migrations.py` (cabeza `004`), `test_config.py`, `settings_env.py`, `test_env_example.py`, `test_optional_integrations.py`, `test_pago_autorizacion.py`, `test_pago.py`, `test_flujo_compra_pago_entrega.py`, `schema_expectations.py`.
- **Config** (requiere autorización explícita del usuario): quitar `MP_NOTIFICATION_URL` de `backend/.env.example`, `backend/tests/.env.test.example` y del `.env`/`.env.test` locales; configurar en el panel de MercadoPago (modo Prueba) el Webhook con el evento «Order (Mercado Pago)» apuntando a `<ngrok>/api/v1/pagos/webhook`.
- **Docs** (como tareas, fuera de esta revisión): `knowledge-base/11` (Orders API, tópico `order`, estados), `09` (nota en DD-21: Checkout API vía Orders), `04` (`Pago`), `08` (variables), `backend/README.md`, `CHANGES.md` (alcance de C-12).
