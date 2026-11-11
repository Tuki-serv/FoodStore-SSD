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

**Fuera de alcance (con dueño):** pantalla de checkout con el brick (C-20, frontend); otros medios del Payment Brick (Rapipago/Pago Fácil/cuenta MP) y Orders API (ver design D1); reembolsos y reacción a `refunded`/`cancelled` `[PENDIENTE DE DECISIÓN: PA-08]`; sacar los `HTTPException` restantes de otros services (C-25a).

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `payment-api`: el contrato de `POST /pagos/crear` (token de tarjeta, idempotencia, precondiciones, resultado sincrónico, reintento, errores de MercadoPago), el de `GET /pagos/{pedido_id}` (`mp_status_detail`), la asociación del webhook por `external_reference` y el retiro de la ruta de redirect de «Rutas públicas de pagos».
- `backend-config`: se retiran `BACKEND_PUBLIC_URL` y `FRONTEND_URL` (de las opcionales, del requisito «URLs explícitas del flujo de pago actual» y de los escenarios que las nombran); pasan a la lista de variables retiradas.
- `backend-runtime`: «Pagos sin MercadoPago configurado» deja de mencionar `BACKEND_PUBLIC_URL`, `FRONTEND_URL` y el redirect.
- `backend-db-migrations`: nueva migración `003` (referencia externa UUID única y obligatoria, retiro de columnas de Checkout Pro) que pasa a ser la cabeza.
- `api-conventions`: nuevo código de negocio `PAYMENT_NOT_ALLOWED` (409).

## Impact

- **Código**: `modules/pagos/` — `schemas.py` (request/response nuevos), `service.py` (flujo Checkout API, precondiciones, reintento, aplicación de estado compartida con el webhook, 503 con `AppError`), adaptador nuevo del borde MercadoPago (`gateway_mp.py` o similar) para crear/consultar pagos, `repository.py` (`get_by_external_reference_for_update`), `router.py` (sin redirect), `models.py` (`external_reference` UUID NN, sin columnas de preferencia); `core/config.py` (sin `BACKEND_PUBLIC_URL`/`FRONTEND_URL`); `core/errors.py` (`PAYMENT_NOT_ALLOWED`); `alembic/versions/003_*.py`.
- **API**: cambios incompatibles en `POST /api/v1/pagos/crear` y `GET /api/v1/pagos/{pedido_id}` (campos nuevos); `GET /api/v1/pagos/redirect/...` desaparece (404). El webhook mantiene su contrato.
- **Datos**: migración `003`; las filas de `pagos` existentes reciben un UUID nuevo en `external_reference` (su referencia numérica se pierde) y pierden `mp_preference_id`/`mp_init_point`.
- **Tests**: nuevo `tests/integration/test_pago_checkout_api.py` (aprobado, rechazado, pendiente, reintento, errores de MercadoPago, idempotencia) con el SDK mockeado en el borde; actualizar `test_pago_autorizacion.py`, `test_optional_integrations.py`, `test_pago.py`, `test_pago_webhook_*.py` (referencia UUID), `tests/support/mp_webhook.py` y `pagos_factory.py`, `tests/unit/test_config.py`, `test_env_example.py`/`settings_env.py`, `test_migrations.py` (cabeza `003`).
- **Config**: `backend/.env.example` sin `BACKEND_PUBLIC_URL` ni `FRONTEND_URL` (requiere autorización explícita para editarlo, como en C-05).
- **Docs**: `knowledge-base/11` (modalidades, flujo de cobro, riesgos), `07` (Flujo 4 pasos 5–7), `05` (RN-PA-01/02/03), `04` (`Pago`), `08` (variables), `09` (DT-01 y DT-26 resueltas), `backend/README.md` (variables), `CHANGES.md` (C-12 `[x]` al archivar).
