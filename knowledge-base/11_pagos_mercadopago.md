# Pagos — Integración MercadoPago

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Extra del dominio de pagos. Reglas relacionadas: RN-PA-01..06 en [05](05_reglas_de_negocio.md). Divergencias: IN-22, IN-25, IN-26 en [10](10_preguntas_abiertas.md).

## Modalidades

Objetivo (spec `[INT]`) y código actual coinciden desde C-12 en lo que hace al cobro: **Checkout API** sobre el recurso Payments (`/v1/payments`). DT-01, DT-05, DT-06 y DT-20 están resueltas.

| Aspecto | Estado actual (= objetivo) |
|---------|----------------------------|
| Producto MP | **Checkout API / Payments** con el brick `CardPayment` (tarjeta crédito/débito), sin redirigir fuera del sitio. Orders API, Rapipago/Pago Fácil/cuenta MP y 3DS quedan fuera (no implementados) |
| Tokenización | MercadoPago.js / `@mercadopago/sdk-react` (`CardPayment`) en el navegador; el backend recibe solo el token (`extra="forbid"`: número, CVV o vencimiento → 422) |
| Crear pago | `POST /pagos/crear {pedido_id, token, payment_method_id, installments, issuer_id?, payer{email, identification?}}` → 201 `{pago_id, pedido_id, estado, mp_payment_id, mp_status, mp_status_detail}` (propietario o ADMIN) |
| Webhook | `POST /pagos/webhook` con firma `x-signature` validada (C-05) |
| Idempotencia | `idempotency_key` UUID por intento, enviado como `X-Idempotency-Key`; `external_reference` UUID único por intento; el webhook deduplica por `mp_payment_id` |
| Consultar | `GET /pagos/{pedido_id}` → `{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (propietario/ADMIN) |
| Retorno | No existe: el resultado llega en la respuesta de crear y en `GET /pagos/{pedido_id}` (`/pagos/redirect/...` → 404; `BACKEND_PUBLIC_URL` y `FRONTEND_URL` retiradas, *solo mención histórica*) |

PCI DSS **SAQ-A**: datos de tarjeta nunca pasan por el servidor de Food Store.

## Flujo de cobro (Checkout API, C-12)

`POST /pagos/crear` se ejecuta en dos transacciones cortas con la llamada a MercadoPago afuera (sin locks de base durante la red):

1. **T1**: 401 → 404 → 403 → precondiciones (409 `PAYMENT_NOT_ALLOWED`: el pedido debe ser `MERCADOPAGO`, `PENDIENTE`, sin pago `aprobado`/`a_devolver` ni en proceso con id de MercadoPago) → 503 si falta `MP_ACCESS_TOKEN` o `MP_NOTIFICATION_URL`. El pedido se bloquea con `SELECT ... FOR UPDATE`: dos `crear` concurrentes se serializan. Se guarda el intento `pendiente` con `idempotency_key` y `external_reference` UUID nuevos (o se **reutiliza** el último intento si quedó sin `mp_payment_id`).
2. **MercadoPago** (`PasarelaMercadoPago`, único módulo que conoce el SDK): `payment().create` con el monto del pedido (`Decimal` → 2 decimales), `external_reference`, `notification_url` y `X-Idempotency-Key`. 4xx → 400 `HTTP_400` y el intento queda `rechazado`; red/5xx → 502 `HTTP_502` y el intento queda reutilizable.
3. **T2**: relee el intento con bloqueo y aplica el resultado por el **mismo camino que el webhook** (`_aplicar_resultado_mp`): `approved` → pago `aprobado` y pedido `CONFIRMADO` en la misma transacción (actor Sistema, stock, historial; sin stock → pedido `CANCELADO` y pago `a_devolver`); `rejected` → `rechazado`; `in_process`/`pending` → `pendiente` con `mp_payment_id`. Si el webhook ganó la carrera, la respuesta refleja el estado ya guardado.
4. El webhook sigue siendo la confirmación (Flujo 5 de [07](07_flujos_principales.md)); encuentra el intento por `mp_payment_id` → `external_reference` (UUID del intento, no «el último del pedido») → `merchant_order_id`.

Reintento: tras `rechazado` (de MercadoPago o por datos rechazados) se crea un intento nuevo con claves nuevas; tras un resultado desconocido (502) se reutiliza el intento con su misma `X-Idempotency-Key` para que MercadoPago no cobre dos veces.

## Estados y acciones

| MP | Local | Acción |
|----|-------|--------|
| `approved` | `aprobado` | Pedido PENDIENTE→CONFIRMADO con descuento de stock (actor Sistema). Si el stock ya no alcanza: pedido CANCELADO («Sin stock») y el pago pasa al estado local `a_devolver` (devolución manual, PA-08) |
| `pending`, `in_process`, `authorized` | `pendiente` | Sin cambios |
| `rejected`, `cancelled`, `refunded`, `charged_back` | `rechazado` | Sin cambios; reintento posible (un nuevo pago aprobado con otro `mp_payment_id` se procesa) |
| otros | — | `ignored` |

Estados locales del pago: `pendiente`, `aprobado`, `rechazado` y `a_devolver` (aprobado en MP pero sin pedido que lo respalde: sin stock, pedido `CANCELADO`, `EFECTIVO`/`TRANSFERENCIA` o ya confirmado; `mp_status` conserva `approved`). `aprobado` y `a_devolver` son terminales (`already_processed`); un cambio posterior en MP (p. ej. `approved` → `refunded`) no se refleja (PA-08).

## Sandbox

Tarjetas de prueba de `[INT]` (vencimiento indicado `11/25`, hoy vencido; usar fecha futura; el brick `CardPayment` genera el token): Visa aprobada `4509 9535 6623 3704` (CVV 123); American Express aprobada `3714 496353 98431` (CVV 1234); Visa rechazada `4000 0000 0000 0002` (CVV 123). Credenciales `TEST-...` para sandbox; `APP_USR-...` producción. Para recibir notificaciones en local se usa **ngrok** (`MP_NOTIFICATION_URL` = URL pública + `/api/v1/pagos/webhook`; se envía como `notification_url` en cada pago). **Pendiente de confirmar en sandbox (OQ-3 de C-12):** que esas notificaciones lleguen con `x-signature`. En el panel de MercadoPago configurar solo «Webhooks» (evento `payment`) y copiar la clave secreta a `MP_WEBHOOK_SECRET`.

## Webhook: objetivo y estado actual (C-05)

| Aspecto | Estado |
|---------|--------|
| Firma `x-signature` | Validada con `MP_WEBHOOK_SECRET` (validador del SDK `mercadopago>=3.6.0`); inválida → 401, sin secreto → 503 |
| Idempotencia | Por `mp_payment_id` con `SELECT ... FOR UPDATE` sobre `pagos` (`decidir_transicion_pago`); `idempotency_key` es la clave de creación del pago (`X-Idempotency-Key`) |
| Transacción | Una sola: pago + transición del pedido + stock + historial (UoW reentrante con savepoint) |
| Códigos | 200 / 401 / 400 / 502 / 503 / 500 (ver Flujo 5 de [07](07_flujos_principales.md)) |

## Riesgos conocidos (DT-06, DT-20 y DT-21 resueltas por C-05; DT-05 por C-04; DT-01 y DT-26 por C-12)

- Las notificaciones legacy IPN (`?id=&topic=`) no vienen firmadas y reciben 401: configurar en el panel de MercadoPago solo «Webhooks» (evento `payment`).
- Sin ventana de tolerancia sobre `ts`: una notificación auténtica capturada puede reenviarse, sin efecto porque el estado se toma de la API de MP y el procesamiento es idempotente.
- El SDK emite un `DeprecationWarning` por `notification_url` en el cuerpo del pago; se silencia en el adaptador. Si el sandbox mostrara que esas notificaciones no llegan firmadas, habría que usar solo Webhooks del panel y retirar `MP_NOTIFICATION_URL` (OQ-3).
- MercadoPago conserva las claves de idempotencia un tiempo acotado: un reintento muy tardío sobre un intento de resultado desconocido podría cobrar de nuevo; el webhook deja un segundo cobro aprobado del mismo pedido como `a_devolver`.
- Sin reembolso/cancelación automática de pago al cancelar el pedido ni ante `refunded` posterior (PA-08); los pagos `a_devolver` requieren gestión manual.
