# Pagos — Integración MercadoPago

> **Regla de la KB (DD-16/DD-17):** la spec (integrador v5.0) es el objetivo; el código actual es el estado actual con deuda técnica. Tabla consolidada: [09](09_decisiones_y_supuestos.md#deuda-técnica--divergencias-código-vs-spec-tabla-consolidada).

Extra del dominio de pagos. Reglas relacionadas: RN-PA-01..06 en [05](05_reglas_de_negocio.md). Divergencias: IN-22, IN-25, IN-26 en [10](10_preguntas_abiertas.md).

## Modalidades

Objetivo = columna "Spec" (normativa). La columna "Código actual" es **deuda técnica** (DT-01, DT-05, DT-06, DT-20).

| Aspecto | Objetivo (spec `[INT]`) | Código actual (deuda) |
|---------|------------------------|---------------------------|
| Producto MP | Checkout API / Orders; medios: tarjeta crédito/débito, Rapipago, Pago Fácil, cuenta MP, sin redirigir fuera del sitio | **Checkout Pro**: preferencia + `init_point`, el cliente paga en el sitio de MP |
| Tokenización | MercadoPago.js / `@mercadopago/sdk-react` (`CardPayment`) en el navegador; backend recibe el token | No aplica (el pago ocurre en MP); la `public_key` se devuelve igualmente |
| Crear pago | `POST /pagos/crear` (con token de tarjeta) / `crear-preferencia` | `POST /pagos/crear {pedido_id}` → `{pago_id, preference_id, init_point, public_key}` |
| Webhook | `POST /pagos/webhook` (o `/ipn`), validar firma | `POST /pagos/webhook` — **sin validación de firma** |
| Idempotencia | `idempotency_key` UUID; ignorar duplicados | UUID generado en `crear_pago`; deduplicación real por `pago.estado != "pendiente"` |
| Consultar | `GET /pagos/{pedido_id}` (propietario/ADMIN) | `GET /pagos/{pedido_id}` → `{estado, pedido_id}` **sin auth** |
| Retorno | URL de retorno al frontend | `GET /pagos/redirect/{pedido_id}/{status}` redirige a `{VITE_FRONTEND_URL}/payment/feedback/{pedido_id}?status=...&<params de MP>` |

PCI DSS **SAQ-A**: datos de tarjeta nunca pasan por el servidor de Food Store.

## Flujo de cobro (código actual — deuda DT-01)

El flujo objetivo es Checkout API/Orders: el frontend tokeniza la tarjeta con `CardPayment`, el backend crea el pago autenticado con `idempotency_key` y el webhook (con firma validada) avanza el pedido. Lo siguiente describe lo que hace hoy el código:

1. `crear_pago(pedido_id)`: pedido debe existir (no se valida estado PENDIENTE ni propietario ni que ya exista un pago aprobado). Requiere `MP_ACCESS_TOKEN` (400 si falta).
2. Construye preferencia: un solo ítem `{title: "Pedido #N - FoodStore", quantity: 1, unit_price: float(total), currency_id: "ARS"}`, `external_reference = str(pedido_id)`, `back_urls` (success/failure/pending → `NGROK_URL/api/v1/pagos/redirect/{id}/{status}`), `auto_return: "approved"`, `notification_url = NGROK_URL/api/v1/pagos/webhook`. Si `NGROK_URL` no está, usa `http://localhost:8000` (MP no puede notificar a localhost).
3. Guarda `Pago(estado="pendiente", mp_preference_id, mp_init_point, idempotency_key=uuid4, transaction_amount=total)`.
4. El webhook procesa el evento (Flujo 5 de [07](07_flujos_principales.md)).

## Estados y acciones

| MP | Local | Acción |
|----|-------|--------|
| `approved` | `aprobado` | Pedido PENDIENTE→CONFIRMADO con descuento de stock (actor Sistema). Si el stock ya no alcanza: pedido CANCELADO («Sin stock») y el pago pasa al estado local `a_devolver` (devolución manual, PA-08) |
| `pending`, `in_process`, `authorized` | `pendiente` | Sin cambios |
| `rejected`, `cancelled`, `refunded`, `charged_back` | `rechazado` | Sin cambios; reintento posible (un nuevo pago aprobado con otro `mp_payment_id` se procesa) |
| otros | — | `ignored` |

Estados locales del pago: `pendiente`, `aprobado`, `rechazado` y `a_devolver` (aprobado en MP pero sin pedido que lo respalde: sin stock, pedido `CANCELADO`, `EFECTIVO`/`TRANSFERENCIA` o ya confirmado; `mp_status` conserva `approved`). `aprobado` y `a_devolver` son terminales (`already_processed`); un cambio posterior en MP (p. ej. `approved` → `refunded`) no se refleja (PA-08).

## Sandbox

Tarjetas de prueba de `[INT]` (vencimiento indicado `11/25`, hoy vencido; usar fecha futura): Visa aprobada `4509 9535 6623 3704` (CVV 123); American Express aprobada `3714 496353 98431` (CVV 1234); Visa rechazada `4000 0000 0000 0002` (CVV 123). Credenciales `TEST-...` para sandbox; `APP_USR-...` producción. Para recibir webhooks en local se usa **ngrok**. En el panel de MercadoPago configurar solo «Webhooks» (evento `payment`) y copiar la clave secreta a `MP_WEBHOOK_SECRET`.

## Webhook: objetivo y estado actual (C-05)

| Aspecto | Estado |
|---------|--------|
| Firma `x-signature` | Validada con `MP_WEBHOOK_SECRET` (validador del SDK `mercadopago>=3.6.0`); inválida → 401, sin secreto → 503 |
| Idempotencia | Por `mp_payment_id` con `SELECT ... FOR UPDATE` sobre `pagos` (`decidir_transicion_pago`); `idempotency_key` es solo la clave de creación del pago |
| Transacción | Una sola: pago + transición del pedido + stock + historial (UoW reentrante con savepoint) |
| Códigos | 200 / 401 / 400 / 502 / 503 / 500 (ver Flujo 5 de [07](07_flujos_principales.md)) |

## Riesgos conocidos (DT-06, DT-20 y DT-21 resueltas por C-05; DT-05 por C-04)

- Las notificaciones legacy IPN (`?id=&topic=`) no vienen firmadas y reciben 401: configurar en el panel de MercadoPago solo «Webhooks» (evento `payment`).
- Sin ventana de tolerancia sobre `ts`: una notificación auténtica capturada puede reenviarse, sin efecto porque el estado se toma de la API de MP y el procesamiento es idempotente.
- `float(monto)` al enviar a MP: puede introducir errores de redondeo; usar Decimal→2 decimales.
- Sin reembolso/cancelación automática de pago al cancelar el pedido ni ante `refunded` posterior (PA-08); los pagos `a_devolver` requieren gestión manual.
