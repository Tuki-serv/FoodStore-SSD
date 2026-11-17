# Pagos — Integración MercadoPago

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Extra del dominio de pagos. Reglas relacionadas: RN-PA-01..06 en [05](05_reglas_de_negocio.md). Divergencias: IN-22, IN-25, IN-26 en [10](10_preguntas_abiertas.md).

## Modalidades

Objetivo (spec `[INT]`) y código actual coinciden desde C-12 en lo que hace al cobro: **Checkout API** sobre la **Orders API** (`POST /v1/orders`, `sdk.order()`). La primera implementación usó el recurso Payments (`/v1/payments`); se migró a Orders el 2026-11-15 porque el sandbox rechazaba las credenciales de prueba en Payments (DD-26). DT-01, DT-05, DT-06 y DT-20 están resueltas.

| Aspecto | Estado actual (= objetivo) |
|---------|----------------------------|
| Producto MP | **Checkout API / Orders** con el brick `CardPayment` (tarjeta crédito/débito), sin redirigir fuera del sitio. Rapipago/Pago Fácil/cuenta MP y el challenge 3DS quedan fuera (no implementados). La aplicación se crea en el panel de MercadoPago como Checkout API con «API de Orders» (el panel rotula «API de Payments» como «Esta API será descontinuada pronto») |
| Tokenización | MercadoPago.js / `@mercadopago/sdk-react` (`CardPayment`) en el navegador; el backend recibe solo el token (`extra="forbid"`: número, CVV o vencimiento → 422) |
| Crear pago | `POST /pagos/crear {pedido_id, token, payment_method_id, payment_type_id, installments, issuer_id?, payer{email, identification?}}` (`payment_type_id` = `credit_card`\|`debit_card`, del `additionalData.paymentTypeId` del brick; `issuer_id` se acepta y no se reenvía a MP) → 201 `{pago_id, pedido_id, estado, mp_order_id, mp_payment_id, mp_status, mp_status_detail}` (propietario o ADMIN) |
| Webhook | `POST /pagos/webhook` con firma `x-signature` validada (C-05); evento **«Order (Mercado Pago)»**, tópico `order`, `data.id` = id de la orden (`ORD…`). Los tópicos `payment` y `merchant_order` no se procesan (200 `ignored`) |
| Idempotencia | `idempotency_key` UUID por intento, enviado como `X-Idempotency-Key`; `external_reference` UUID único por intento; el webhook deduplica por `mp_order_id` (id de la orden, texto) |
| Consultar | `GET /pagos/{pedido_id}` → `{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (propietario/ADMIN); `mp_status` es el estado de la **orden** y `mp_status_detail` el de la **transacción** |
| Retorno | No existe: el resultado llega en la respuesta de crear y en `GET /pagos/{pedido_id}` (`/pagos/redirect/...` → 404; `BACKEND_PUBLIC_URL` y `FRONTEND_URL` retiradas, *solo mención histórica*) |

PCI DSS **SAQ-A**: datos de tarjeta nunca pasan por el servidor de Food Store.

## Flujo de cobro (Checkout API sobre Orders, C-12)

`POST /pagos/crear` se ejecuta en dos transacciones cortas con la llamada a MercadoPago afuera (sin locks de base durante la red):

1. **T1**: 401 → 404 → 403 → precondiciones (409 `PAYMENT_NOT_ALLOWED`: el pedido debe ser `MERCADOPAGO`, `PENDIENTE`, sin pago `aprobado`/`a_devolver` ni en proceso con orden creada en MercadoPago) → 503 si falta `MP_ACCESS_TOKEN` (`MP_NOTIFICATION_URL` está retirada: Orders no tiene `notification_url`). El pedido se bloquea con `SELECT ... FOR UPDATE`: dos `crear` concurrentes se serializan. Se guarda el intento `pendiente` con `idempotency_key` y `external_reference` UUID nuevos (o se **reutiliza** el último intento si quedó sin `mp_order_id`).
2. **MercadoPago** (`PasarelaMercadoPago`, único módulo que conoce el SDK): `order().create` con una orden `type: online`, `processing_mode: automatic` y una transacción de tarjeta; el monto del pedido va como **texto** con 2 decimales (`"1500.50"`), junto con `external_reference` y `X-Idempotency-Key` (sin `notification_url` ni `issuer_id`). Respuestas: 402 con la orden `failed` → resultado `rechazado` (no es error); 4xx de datos → 400 `HTTP_400` y el intento queda `rechazado`; **401/403 (credenciales rechazadas por MercadoPago) → 503 `HTTP_503`** y el intento queda reutilizable; 409 `idempotency_key_already_used` → se busca la orden por `external_reference` (si no aparece, 502); 423, red y 5xx → 502 `HTTP_502` y el intento queda reutilizable.
3. **T2**: relee el intento con bloqueo y aplica el resultado por el **mismo camino que el webhook** (`_aplicar_resultado_mp`): orden `processed` → pago `aprobado` y pedido `CONFIRMADO` en la misma transacción (actor Sistema, stock, historial; sin stock → pedido `CANCELADO` y pago `a_devolver`); `failed` → `rechazado`; `processing`/`action_required` → `pendiente` con `mp_order_id`. Si el webhook ganó la carrera, la respuesta refleja el estado ya guardado.
4. El webhook sigue siendo la confirmación (Flujo 5 de [07](07_flujos_principales.md)); consulta `GET /v1/orders/{id}` y encuentra el intento por `mp_order_id` → `external_reference` (UUID del intento, no «el último del pedido»). `mp_merchant_order_id` se retiró (migración `004`).

Reintento: tras `rechazado` (de MercadoPago o por datos rechazados) se crea un intento nuevo con claves nuevas; tras un resultado desconocido (502, o 503 por credenciales rechazadas) se reutiliza el intento con su misma `X-Idempotency-Key` para que MercadoPago no cobre dos veces (si la clave ya se usó, 409 y reconciliación por `external_reference`).

## Estados y acciones

Se mapea el estado de la **orden** (Orders):

| MP (orden) | Local | Acción |
|----|-------|--------|
| `processed` (`accredited`; también `partially_refunded`) | `aprobado` | Pedido PENDIENTE→CONFIRMADO con descuento de stock (actor Sistema). Si el stock ya no alcanza: pedido CANCELADO («Sin stock») y el pago pasa al estado local `a_devolver` (devolución manual, PA-08) |
| `created`, `processing` (`in_process`), `action_required` (`waiting_payment`, `pending_challenge`, …) | `pendiente` | Sin cambios; lo resuelve el webhook |
| `failed`, `canceled`, `refunded`, `charged_back` | `rechazado` | Sin cambios; reintento posible (una nueva orden aprobada con otro `mp_order_id` se procesa) |
| otros | — | `ignored` |

Estados locales del pago: `pendiente`, `aprobado`, `rechazado` y `a_devolver` (aprobado en MP pero sin pedido que lo respalde: sin stock, pedido `CANCELADO`, `EFECTIVO`/`TRANSFERENCIA` o ya confirmado; `mp_status` conserva `processed`). `aprobado` y `a_devolver` son terminales (`already_processed`); un cambio posterior en MP (p. ej. `processed` → `refunded`) no se refleja (PA-08).

## Sandbox

Tarjetas de prueba de Orders (el brick `CardPayment` genera el token; vencimiento futuro, p. ej. `11/30`; DNI `12345678`): Mastercard `5031 7557 3453 0604` o Visa `4509 9535 6623 3704` (CVV `123`). El **nombre del titular** decide el resultado: `APRO` aprobado, `FUND` fondos insuficientes, `OTHE` rechazo genérico, `CONT` pago en proceso. El email del pagador debe ser el de un comprador de prueba.

**Configuración del panel de MercadoPago (modo Prueba):** aplicación creada como Checkout API con «API de Orders»; credenciales del vendedor de prueba (`APP_USR-…`, que sirven para Orders); en «Webhooks» configurar la URL pública (ngrok) `<url>/api/v1/pagos/webhook` con el evento **«Order (Mercado Pago)»** y copiar la clave secreta a `MP_WEBHOOK_SECRET`. La URL del webhook se configura **solo en el panel**: `MP_NOTIFICATION_URL` se retiró (Orders no admite `notification_url` por orden).

**Hechos observados en sandbox (2026-11-16, parcial):**
- Con las mismas credenciales, `POST /v1/payments` respondía 401 «Unauthorized use of live credentials» (causa `7`); `POST /v1/orders` las acepta.
- Caso `APRO`: `POST /pagos/crear` → pago `aprobado`, orden `processed`/`accredited`, `mp_order_id` con prefijo `ORDTST…`, `mp_payment_id` con prefijo `PAY…`; pedido `CONFIRMADO` y stock descontado.
- Unos 2–4 s después MercadoPago llama `POST /pagos/webhook?data.external_reference=<uuid>&data.id=ORDTST…&type=order` con `x-signature` y `x-request-id`, cuerpo `action: order.processed` con la orden en `data`; el backend responde 200 `already_processed` (la creación ya había confirmado el pedido).
- **La firma validó con `data.id` en minúsculas** (con el id tal como llegó, no); se observó una sola notificación. El backend prueba ambas variantes; dejar solo la de minúsculas queda como decisión de seguimiento (OQ-13 de C-12).
- Pendiente de verificar: `FUND`, `OTHE`, `CONT`, reintento tras rechazo y qué responde MercadoPago ante una clave de idempotencia repetida (OQ-14).

## Webhook: objetivo y estado actual (C-05)

| Aspecto | Estado |
|---------|--------|
| Firma `x-signature` | Validada con `MP_WEBHOOK_SECRET`: manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, con `data.id` en minúsculas y, si no firma, tal cual; inválida → 401, sin secreto → 503 |
| Tópico y consulta | Solo `order`; el estado no se toma del cuerpo: se consulta `GET /v1/orders/{id}`. 401/403 de MercadoPago al consultar → 503; otra falla → 502 |
| Idempotencia | Por `mp_order_id` (texto) con `SELECT ... FOR UPDATE` sobre `pagos` (`decidir_transicion_pago`); `idempotency_key` es la clave de creación de la orden (`X-Idempotency-Key`) |
| Transacción | Una sola: pago + transición del pedido + stock + historial (UoW reentrante con savepoint) |
| Códigos | 200 / 401 / 400 / 502 / 503 / 500 (ver Flujo 5 de [07](07_flujos_principales.md)) |

## Riesgos conocidos (DT-06, DT-20 y DT-21 resueltas por C-05; DT-05 por C-04; DT-01 y DT-26 por C-12, ajustadas a Orders por DD-26)

- Las notificaciones legacy IPN (`?id=&topic=`) no vienen firmadas y reciben 401: configurar en el panel de MercadoPago solo «Webhooks» (evento «Order (Mercado Pago)»). Los tópicos `payment` y `merchant_order` no son compatibles con Orders.
- Sin ventana de tolerancia sobre `ts`: una notificación auténtica capturada puede reenviarse, sin efecto porque el estado se toma de la API de MP y el procesamiento es idempotente.
- Orders no tiene `notification_url`: `MP_NOTIFICATION_URL` se retiró (OQ-3 resuelta) y el webhook se configura solo en el panel.
- Credenciales rechazadas por MercadoPago (401/403) responden 503, no 400: el intento queda reutilizable y no se marca `rechazado`.
- Con `capture_mode` por defecto (`automatic_async`) la creación puede devolver `processing`: el pago queda `pendiente` hasta el webhook. El challenge 3DS (`action_required`/`pending_challenge`) no se implementa.
- MercadoPago conserva las claves de idempotencia un tiempo acotado: un reintento muy tardío sobre un intento de resultado desconocido podría cobrar de nuevo; el webhook deja un segundo cobro aprobado del mismo pedido como `a_devolver`.
- Sin reembolso/cancelación automática de pago al cancelar el pedido ni ante `refunded` posterior (PA-08); los pagos `a_devolver` requieren gestión manual.
