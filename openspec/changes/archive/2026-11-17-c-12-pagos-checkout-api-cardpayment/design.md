# Design — C-12 `pagos-checkout-api-cardpayment`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/payment-api`, `specs/backend-config`, `specs/backend-runtime`, `specs/backend-db-migrations` y `specs/api-conventions`.

Punto de partida (`dev`, 2026-11-11, C-04, C-05, C-09, C-10 y C-11 archivados):

- `PaymentService(session, construir_pedidos=construir_pedido_service)`: `crear_pago` (Checkout Pro, ver proposal), `procesar_webhook` (C-05: firma → tópico/id → `MP_ACCESS_TOKEN` → `payment.get` → transacción única con `SELECT … FOR UPDATE` y `decidir_transicion_pago`) y `obtener_pago`. El 503 de crear usa `HTTPException`; el resto, `AppError`.
- `UnitOfWork` reentrante con savepoint (C-05 D6): `PedidoService.confirmar_por_pago_aprobado` corre anidado dentro de `PagoUnitOfWork` y todo se confirma en el `commit` externo.
- `_resolver_pago_bloqueado`: `mp_payment_id` → `int(external_reference)` como id de pedido (último pago) → `merchant_order_id`.
- `PagoUnitOfWork` expone `pagos` y `pedidos`; `PagoRepository` tiene lecturas `*_for_update`.
- SDK `mercadopago` 3.6.0: `sdk.payment().create(dict, request_options)` → `{"status": 201, "response": {...}}`; `RequestOptions(custom_headers={"x-idempotency-key": ...})` reemplaza la clave aleatoria que el SDK pone por defecto (1–64 caracteres). Pasar `notification_url` en el cuerpo emite un `DeprecationWarning` (el SDK recomienda configurar Webhooks en el panel). `sdk.order()` (Orders API) también existe.
- Tests: PostgreSQL real `foodstore_test`, sesión por test con savepoint; borde de MercadoPago mockeado con `tests/support/mp_webhook.py::MPFalso` (parcheando `app.modules.pagos.service.mercadopago.SDK`); firma real con `mp_firma.firmar`.
- Migraciones: cabeza `002`; `pagos.external_reference VARCHAR(100) NULL`; `test_migrations.py` fija la cabeza en `"002"` en varios tests.

## Goals / Non-Goals

**Goals:** cobrar con token de tarjeta sin que los datos de la tarjeta toquen el backend; que crear un pago sea seguro ante reintentos (sin doble cobro) y ante carreras con el webhook; reutilizar la lógica de aplicación de estados del webhook (una sola fuente de verdad); dejar `external_reference` como clave única por intento; retirar todo rastro de Checkout Pro.

**Non-Goals:** frontend del brick (C-20); otros medios del Payment Brick (efectivo en Rapipago/Pago Fácil, cuenta MP) y 3DS/challenge; ~~Orders API (D1)~~ (incorporada por D16, 2026-11-15); reembolsos o reacción a `refunded`/`cancelled` (PA-08); ventana de tolerancia del `ts` de la firma (C-05 D3); cola asíncrona; tocar `MP_PUBLIC_KEY` (sale de la respuesta de crear porque el brick la necesita antes de tokenizar; C-20 decide si el frontend la lee de `VITE_*` o de un endpoint).

## Decisions

> **Revisión 2026-11-15:** D1 queda **reemplazada por D16** (Orders API), D10 por **D24** y D11 por **D18**. D2 (adaptador), D6 (reintento) y D9 (búsqueda del webhook) se ajustan en D17, D22 y D23. El resto sigue vigente. Ver §«Revisión 2026-11-15: Orders API».

**D1 — Checkout API sobre el recurso Payments (`/v1/payments`), no Orders API.** *(Reemplazada por D16, 2026-11-15.)*
`POST /pagos/crear` llama a `sdk.payment().create(...)`.
*Por qué:* el `formData` del brick `CardPayment` (`token`, `payment_method_id`, `installments`, `issuer_id`, `payer`) es exactamente el cuerpo de `/v1/payments`; la respuesta trae `id`, `status` y `status_detail` que el webhook de C-05 ya sabe procesar (tópico `payment`, `payment.get`, dedupe por `mp_payment_id`). C-05 queda intacto salvo la búsqueda por referencia (D9).
*Alternativa descartada:* Orders API (`/v1/orders`): las notificaciones son de tópico `order`, con id de orden y estados propios (`processed`, `action_required`, transacciones anidadas); obligaría a rediseñar el webhook, la idempotencia y la tabla (`mp_order_id`). La KB dice «Checkout API / Orders»; RN-PA-01 y DD-21 hablan de Checkout API con `CardPayment`, que Payments cumple. **OQ-1.**

**D2 — Borde de MercadoPago en un adaptador (`pagos/pasarela_mp.py`).**
`PasarelaMercadoPago(access_token)` con dos métodos: `crear_pago(datos: DatosCobroMP, idempotency_key: str) -> ResultadoMP` y `consultar_pago(payment_id: int) -> ResultadoMP` (`ResultadoMP`: `mp_payment_id`, `mp_status`, `mp_status_detail`, `mp_merchant_order_id`, `external_reference`). Traduce el SDK:
- 2xx → `ResultadoMP`;
- 4xx en la creación → `PagoRechazadoPorMP(detalle)` (MercadoPago no creó el pago);
- 5xx, `OSError`/`ValueError` (red, `requests`, JSON ilegible) → `MercadoPagoNoDisponible`.
`PaymentService` recibe una fábrica inyectable `pasarela: Callable[[str], PasarelaMercadoPago]` (mismo patrón que `construir_pedidos`). `_consultar_pago_mp` del webhook se muda al adaptador (DRY) y sigue mapeando la falla a 502.
*Por qué:* aísla el SDK (único punto a cambiar si MercadoPago cambia de API), deja el service con lógica pura de negocio y permite tests con el `MPFalso` extendido (`create` además de `get`) sin mockear internos. El adaptador solo construye el cuerpo y headers; nunca loguea el token de tarjeta ni el access token.

**D3 — Contrato de entrada estricto (SAQ-A).**
`CrearPagoRequest` (Pydantic, `model_config = ConfigDict(extra="forbid")`): `pedido_id: int`, `token: str` (no vacío), `payment_method_id: str`, `installments: int ≥ 1`, `issuer_id: int | None`, `payer: PagadorRequest(email: EmailStr, identification: {type, number} | None)`. Cualquier otro campo (número, CVV, vencimiento) → 422 por el handler existente. El monto **nunca** viene del cliente: es `pedido.total`. Descripción: `"Pedido #<id> - FoodStore"`.
*`payer.email`:* se toma del brick (el brick lo pide al pagador). **OQ-2** (alternativa: el email de la cuenta del dueño del pedido).

**D4 — Dos transacciones cortas y la llamada a MercadoPago fuera de toda transacción.**
1. **T1** (`PagoUnitOfWork`): pedido con bloqueo de fila (`PedidoRepository.get_for_update`, nuevo si no existe) → 404 → 403 → precondiciones (D5, 409) → configuración (D8, 503) → crear o reutilizar el intento (D6) → `commit`. El bloqueo del pedido serializa dos `crear` concurrentes del mismo pedido: el segundo ve el intento del primero.
2. **Llamada a MercadoPago** con `X-Idempotency-Key = intento.idempotency_key`, `external_reference = str(intento.external_reference)`, `notification_url = MP_NOTIFICATION_URL` (D10), monto D11. Sin locks de base mientras se espera la red.
3. **T2** (`PagoUnitOfWork`): relee el intento con `FOR UPDATE` y aplica el resultado (D7). Si el webhook ganó la carrera y ya lo procesó, `decidir_transicion_pago` devuelve `already_processed` y la respuesta refleja el estado guardado.
*Por qué:* guardar el intento **antes** de llamar a MercadoPago (hoy se guarda después) garantiza que toda notificación encuentre su pago local por `external_reference`, aun si la respuesta sincrónica se pierde. *Alternativa descartada:* una sola transacción con la llamada adentro: retiene el lock del pedido durante la red y, si el commit falla después de cobrar, se pierde el registro.

**D5 — Precondiciones como decisión pura.**
`decidir_intento(forma_pago, estado_pedido, pagos_del_pedido) -> Intento` en `pagos/decision_cobro.py` (sin I/O, testeable unitariamente), con `Intento.CREAR | REUTILIZAR | NO_PERMITIDO`:
- forma de pago ≠ `MERCADOPAGO` o estado ≠ `PENDIENTE` → `NO_PERMITIDO`;
- algún pago del pedido `aprobado` o `a_devolver` → `NO_PERMITIDO`;
- último pago `pendiente` **con** `mp_payment_id` (en proceso en MercadoPago) → `NO_PERMITIDO`;
- último pago `pendiente` **sin** `mp_payment_id` (resultado desconocido) → `REUTILIZAR`;
- sin pagos o último `rechazado` → `CREAR`.
`NO_PERMITIDO` → `AppError(409, ErrorCode.PAYMENT_NOT_ALLOWED, <motivo legible>)`. Código nuevo en `ErrorCode` y en `api-conventions`.
*Por qué un código propio y no `INVALID_TRANSITION`:* no es una transición de la FSM y el frontend (C-20) necesita distinguir «este pedido no se puede pagar» de un conflicto de estados. *Orden 409 antes que 503:* el motivo de negocio es más útil que la configuración y no filtra nada a quien no tiene acceso (403 va antes). **OQ-8.**

**D6 — Reintento: intento nuevo tras rechazo, el mismo intento tras resultado desconocido.**
- Tras `rechazado` (por MercadoPago o por datos rechazados, D7) → intento **nuevo**: `idempotency_key = uuid4()`, `external_reference = uuid4()`. Los tokens del brick son de un solo uso, así que el cliente siempre manda uno nuevo.
- Tras 502 (MercadoPago no respondió o 5xx): el intento queda `pendiente` sin `mp_payment_id`; el siguiente `crear` lo **reutiliza** con su misma `idempotency_key` y `external_reference`. Si la primera llamada sí llegó a MercadoPago, la clave repetida hace que MercadoPago devuelva el pago original en vez de cobrar otra vez; si no llegó, procesa el nuevo token.
*Por qué:* es la única forma de que un reintento del usuario después de un timeout no termine en doble cobro. *Alternativa descartada:* intento nuevo siempre y confiar en el webhook: si el primer cobro se aprobó, el segundo también se cobra (el webhook lo dejaría `a_devolver`, pero el cliente pagó dos veces). **OQ-6.**
*Pagos `pendiente` heredados de Checkout Pro* (preferencia sin pagar, sin `mp_payment_id`): caen en `REUTILIZAR`; su `idempotency_key` nunca se envió a `/v1/payments`, así que se comporta como una clave nueva. Sin efecto adverso.

**D7 — Aplicación del resultado: un solo camino para crear y para el webhook.**
Se extrae de `procesar_webhook` el método `_aplicar_resultado_mp(uow, pago, resultado: ResultadoMP) -> dict` (mapeo `_estado_local_para`, `decidir_transicion_pago`, actualización de `mp_*` y `estado`, y `_confirmar_pedido_del_pago` si queda `aprobado`). Lo usan el webhook (tras resolver el pago, D9) y T2 de `crear`.
- `approved` → pedido `CONFIRMADO` en la misma transacción (actor Sistema, stock, historial) o `CANCELADO` «Sin stock» con pago `a_devolver` — idéntico al webhook. **OQ-5** (alternativa: no confirmar en la creación y esperar el webhook; descartada porque dejaría un pago `aprobado` con el pedido `PENDIENTE`, rompiendo el invariante de C-05).
- `rejected` → `rechazado`, 201 con `mp_status_detail`.
- `in_process`/`pending`/`authorized` → `pendiente` con `mp_payment_id`.
- estado no mapeado → el intento queda como está (`pendiente` con `mp_payment_id` y `mp_status` registrados) y responde 201 `pendiente`.
- `PagoRechazadoPorMP` (4xx) → T2 marca el intento `rechazado` sin `mp_payment_id`, `mp_status_detail` con el código de causa de MercadoPago truncado a 100 → `AppError(400, "HTTP_400", "MercadoPago rechazó los datos del pago")` (sin eco de credenciales).
- `MercadoPagoNoDisponible` → sin T2 → `AppError(502, "HTTP_502", "No se pudo crear el pago en MercadoPago")`.
Respuesta `PagoCrearResponse{pago_id, pedido_id, estado, mp_payment_id, mp_status, mp_status_detail}`. El router de crear dispara el WebSocket igual que el webhook cuando hubo `pedido_actualizado` (mismo helper; sin lógica nueva en el router).

**D8 — 503 «MercadoPago no configurado» con `AppError`.**
`_exigir_configuracion_mp` pasa de `HTTPException` a `AppError(503, "HTTP_503", "MercadoPago no configurado: faltan <variables>")` (formato `{detail, code, field}` con `field` nulo). Requeridas para crear: `MP_ACCESS_TOKEN` y `MP_NOTIFICATION_URL` (sale `BACKEND_PUBLIC_URL`). Se evalúa en T1 después de 404/403/409 y antes de insertar el intento.

**D9 — `external_reference` UUID por intento y búsqueda del webhook.**
Modelo: `external_reference: uuid.UUID = Field(default_factory=uuid4, sa_type=Uuid, nullable=False, unique=True)` con `UniqueConstraint(name="uq_pagos_external_reference")`. `idempotency_key` sigue siendo `VARCHAR(100)` con `str(uuid4())` (sin cambio de esquema).
Webhook: `_resolver_pago_bloqueado` = `mp_payment_id` → `PagoRepository.get_by_external_reference_for_update(UUID)` (si el valor de MercadoPago no parsea como UUID, se salta) → `merchant_order_id`. `get_ultimo_by_pedido_for_update` queda sin uso y se elimina.
*Por qué UUID nativo y no `VARCHAR`:* tipo validado por la base (como `sesion.id`) y comparación exacta. *Alternativa:* `VARCHAR(36)` con `CHECK`; equivalente, más verboso.

**D10 — `notification_url` por pago.** *(Reemplazada por D24, 2026-11-15: Orders no tiene `notification_url`.)*
Se envía `notification_url = MP_NOTIFICATION_URL` tal cual (sin derivarla) para que el sandbox con ngrok funcione sin depender del panel. El `DeprecationWarning` del SDK se silencia solo en el adaptador (`warnings.catch_warnings`) para no ensuciar la suite. **OQ-3:** verificar en sandbox que esas notificaciones llegan con `x-signature`; si no, quitar `notification_url`, configurar Webhooks en el panel y retirar `MP_NOTIFICATION_URL` (cambiaría specs `backend-config`/`backend-runtime`).

**D11 — Monto exacto.** *(Reemplazada por D18, 2026-11-15: Orders recibe el monto como texto, sin `float`.)* `pedido.total` (`Decimal`) se cuantiza a `0.01` con `ROUND_HALF_UP` y se convierte a `float` **solo en el adaptador** (el SDK serializa con `json`, que no acepta `Decimal`). `transaction_amount` del intento guarda el `Decimal`.

**D12 — Migración `003_pagos_checkout_api`** (a mano, nombres explícitos):
upgrade: `UPDATE pagos SET external_reference = gen_random_uuid()::text` (todas las filas: ninguna tiene hoy un UUID, son ids de pedido o `NULL`) → `ALTER COLUMN external_reference TYPE uuid USING external_reference::uuid` → `SET NOT NULL` → `CREATE UNIQUE CONSTRAINT uq_pagos_external_reference` → `DROP COLUMN mp_preference_id, mp_init_point`.
downgrade: `DROP CONSTRAINT` → `TYPE VARCHAR(100) USING external_reference::text` → `DROP NOT NULL` → re-agrega `mp_preference_id VARCHAR(255) NULL` y `mp_init_point VARCHAR(500) NULL` (vacías). No restaura las referencias numéricas ni las preferencias (pérdida aceptada: datos de Checkout Pro sin uso). `gen_random_uuid()` es nativa en PostgreSQL ≥ 13 (el proyecto usa 15). **OQ-4** (conservar las columnas de preferencia) y **OQ-7** (rellenar con UUID nuevos).

**D13 — Consulta.** `PagoEstadoResponse{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (`get_ultimo_by_pedido`, orden `created_at DESC, id DESC`); nulos sin intentos.

**D14 — Retiro de Checkout Pro.** Se borran `router.mp_redirect`, `_crear_preferencia_mp`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL` de `Settings`, de `tests/support/settings_env.py` (pasan a `RETIRED_VARS`), del README y de `.env.example` (este último **requiere autorización explícita** del usuario, como en C-05). Los imports de `RedirectResponse`, `urllib.parse` y `HTTPException` salen del router/service.

**D15 — Sin cambios en `order-lifecycle`, `order-stock` ni el seed.** La confirmación por pago aprobado sigue siendo `confirmar_por_pago_aprobado` (actor Sistema); `TARJETA` sigue deshabilitada (C-07).

## Hallazgos del sandbox (2026-11-15)

Sesión de la tarea 10.2 con las credenciales de prueba del vendedor del usuario (access token con prefijo `APP_USR-`, cuenta marcada `test_user`), backend en `dev` con D1..D15 implementadas:

| Llamada (mismo access token) | Resultado |
|---|---|
| `POST /v1/payments` (vía backend y directo; email de comprador de prueba, email común o sin email; token válido del brick o inválido; con y sin `notification_url`) | **401** `Unauthorized use of live credentials`, causa `7`, en todos los casos |
| `GET /v1/payment_methods` | 200 |
| `GET /v1/payments/search` | 200 |
| `POST /checkout/preferences` | 201 |
| `POST /v1/orders` con token falso de 29 caracteres | 400 `property_value` («token length must be >= 32»): pasó la autorización |
| `POST /v1/orders` con token falso de 32 caracteres | **402** con orden de prueba creada: `id` `ORDTST…`, `status: failed`, transacción `PAY…` `invalid_card_token`, `capture_mode: automatic_async`, `processing_mode: automatic`, `type: online` |

Cuerpo que pasó la validación de `/v1/orders` (header `X-Idempotency-Key`): `{type: "online", processing_mode: "automatic", total_amount: "1550.00", external_reference, payer: {email}, transactions: {payments: [{amount: "1550.00", payment_method: {id: "master", type: "credit_card", token, installments: 1}}]}}`.

Efectos en la base: tres intentos reales quedaron `rechazado` con `mp_status_detail` `7` y el backend respondió **400 «MercadoPago rechazó los datos del pago»**: mensaje engañoso, porque el problema era de autorización, no de la tarjeta (corregido por D25). El panel de la aplicación no ofrece «Activar credenciales».

Conclusión: con esta cuenta, el cobro con tarjeta en modo prueba solo funciona por la Orders API. Coincide con la documentación: la guía de migración mapea el 401 `Unauthorized use of live credentials` de Payments a `invalid_credentials` de Orders y presenta `/v1/orders` como reemplazo de `/v1/payments` en Checkout API ([migrar Payments → Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders)). *No confirmado en la documentación:* que MercadoPago bloquee `/v1/payments` para cuentas `test_user` nuevas; se registra como hecho observado, no como regla.

## Resultado de la verificación manual en sandbox (2026-11-16)

Primera tanda de la tarea 10.2, ya con la implementación sobre Orders (§11–§17), `MP_NOTIFICATION_URL` retirada y el Webhook del panel configurado con el evento «Order (Mercado Pago)».

- **Credenciales y aplicación:** usuario vendedor de prueba (access token `APP_USR-`); aplicación creada en el panel de MercadoPago como Checkout API con «API de Orders». El panel rotula «API de Payments» como «Esta API será descontinuada pronto».
- **Caso «Aprobado»** (titular `APRO`, email de comprador de prueba, pedido 1, $1550.00): `POST /api/v1/pagos/crear` → pago `aprobado`, `mp_status` `processed`, `mp_status_detail` `accredited`, `mp_order_id` con prefijo `ORDTST…` y `mp_payment_id` con prefijo `PAY…`. El pedido pasó de `PENDIENTE` a `CONFIRMADO` y el stock del producto bajó de 50 a 49.
- **Webhook:** unos 2–4 s después, MercadoPago llamó a `POST /api/v1/pagos/webhook?data.external_reference=<uuid>&data.id=ORDTST…&type=order` con `x-signature` y `x-request-id`; el cuerpo traía `action: order.processed` y la orden dentro de `data`. El backend respondió 200 `{"status":"already_processed"}` (idempotente: la creación ya había confirmado el pedido).
- **OQ-13 resuelta por observación:** la firma coincidió con el manifest armado con `data.id` en **minúsculas**; con el id tal como llegó, no. Se observó **una** notificación. No se cambia código: retirar la variante «tal cual» de `verificar_firma_webhook` queda como decisión de seguimiento, una vez corridos los casos que faltan.
- **Antes de la migración:** las mismas credenciales daban 401 «Unauthorized use of live credentials» (causa `7`) en `/v1/payments` (ver «Hallazgos del sandbox» arriba).
- **Segunda tanda (2026-11-16, pedido 2, $850.00):**
  - **Fondos insuficientes** (titular `FUND`): pago `rechazado`, `mp_status: failed`, `mp_status_detail: insufficient_amount`, con `mp_order_id`; el pedido siguió `PENDIENTE` y el stock del producto no cambió (100). Webhook `order.failed` firmado → 200 `{"status":"already_processed"}`.
  - **Reintento** (titular `APRO` sobre el mismo pedido): intento nuevo `aprobado` (`processed` / `accredited`), el pedido pasó `PENDIENTE → CONFIRMADO` (una sola transición en el historial) y el stock bajó 100 → 99. Webhook `order.processed` firmado → 200 `{"status":"already_processed"}`. Quedó un pago `rechazado` y uno `aprobado` para el pedido.
  - Las tres notificaciones recibidas llegaron con `x-signature` y fueron aceptadas.
- **No ejecutado:** casos `OTHE` (error general) y `CONT` (pendiente resuelto por webhook) y OQ-14 (clave de idempotencia repetida; requiere cortar la red a mitad de un pago). Siguen cubiertos solo por tests automáticos con el SDK simulado. El usuario decidió cerrar la verificación manual así el 2026-11-16; las tareas 10.2 y 17.4 quedan marcadas con esa salvedad.

## Revisión 2026-11-15: Orders API

Fuentes (consultadas 2026-11-15; cada hecho de MercadoPago abajo cita la suya):
- [S1] Crear orden con tarjeta (AR): https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/payment-integration/cards
- [S2] Migrar de Payments a Orders: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/migrate-payments-to-orders
- [S3] Estados de la orden: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status
- [S4] Notificaciones de Checkout API (Orders): https://www.mercadopago.com.ar/developers/es/docs/checkout-api-v2/notifications
- [S5] Notificaciones opcionales y manifest del validador: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/optional-notifications
- [S6] Regla de `data.id` en minúsculas: https://www.mercadopago.com.br/developers/pt/docs/wallet-connect/notifications
- [S7] Errores al crear una orden: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/payment-management/integration-errors
- [S8] Respuesta `failed` con `errors` + `data`: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/reserve-capture-cancel y 402 `failed`: https://www.mercadopago.com.br/developers/pt/docs/wallet-connect/resources/integration-errors
- [S9] Card Payment Brick con Orders (`additionalData.paymentTypeId`): https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/cards
- [S10] 3DS en Orders (`action_required`/`pending_challenge`): https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/integrate-3ds
- [S11] Tarjetas y titulares de prueba: https://www.mercadopago.com.ar/developers/es/docs/checkout-api-orders/integration-test/cards
- [S12] Tópicos `payment`/`merchant_order` no compatibles con Orders: https://www.mercadopago.com.br/developers/pt/docs/qr-code/resources/migrate-instore-orders-to-orders
- [SDK] `mercadopago` 3.6.0 instalado en `backend/.venv`: `resources/order.py` (`create(dict, request_options)`, `get(order_id: str)`, `search(filters)`), `webhook/validator.py` (manifest con `data_id` «exactly as received»), `config/request_options.py` (`x-idempotency-key` de 1–64 caracteres; si no se pasa, el SDK genera una aleatoria).

**D16 — Checkout API sobre la Orders API (`POST /v1/orders`), reemplaza D1.**
`POST /pagos/crear` crea una orden `type: "online"`, `processing_mode: "automatic"` (crear y procesar en un paso) con **una** transacción de pago con tarjeta [S1][S2]. La respuesta sincrónica trae `id` de la orden (`ORD…`), `status`, `status_detail` y `transactions.payments[]` con `id` (`PAY…`), `status`, `status_detail` [S1].
*Por qué:* evidencia del sandbox (§Hallazgos): Payments rechaza las credenciales de prueba de la cuenta; Orders las acepta. Además Orders es el reemplazo documentado de Payments para Checkout API [S2] y el brick `CardPayment` tiene integración oficial con Orders [S9]. OQ-1 se reabre y se responde por evidencia: **Orders**. *Costo:* rehace el webhook (tópico `order`), los ids (texto) y la tabla (D21), tal como anticipaba D1.

**D17 — El adaptador sigue siendo el único borde; usa el SDK instalado (sin `httpx`).**
`PasarelaMercadoPago` mantiene su forma (`crear_pago(datos, idempotency_key) -> ResultadoMP`, `consultar_orden(order_id: str) -> ResultadoMP`, nuevo `buscar_por_referencia(external_reference: str) -> ResultadoMP | None`) y pasa a llamar `sdk.order().create/get/search` [SDK]. `ResultadoMP` cambia a `mp_order_id: str | None`, `mp_payment_id: str | None` (id de la transacción), `mp_status` (estado de la **orden**), `mp_status_detail` (detalle de la **transacción** si existe, si no el de la orden: `failed`/`failed` a nivel orden no explica nada, la transacción sí, p. ej. `insufficient_amount` [S3][S8]) y `external_reference`. Las excepciones del dominio se conservan (`PagoRechazadoPorMP`, `MercadoPagoNoDisponible`) y se suma `CredencialesMPRechazadas` (D25). El service no conoce ni el SDK ni la forma JSON de Orders.
*SDK vs `httpx`:* `mercadopago` 3.6.0 ya trae `order()` con `create`, `get`, `search`, `process`, `cancel` y `capture` [SDK]; `MPFalso` ya parchea `mercadopago.SDK` en el borde, así que los tests solo suman `order()`. `httpx` ya está en `requirements.txt` (lo usan los tests) pero usarlo en producción duplicaría autenticación, headers, reintentos y serialización que el SDK ya resuelve y obligaría a otro fake. *Elección:* SDK. *Riesgo:* el SDK agrega su propio `x-idempotency-key` aleatorio si no se pasa uno — se pasa siempre el del intento (como hoy) — y valida 1–64 caracteres (la API admite hasta 128 [S7]; el UUID tiene 36). No hace falta actualizar el SDK.

**D18 — Cuerpo de la orden y contrato de entrada (reemplaza D11 y ajusta D3).**
Cuerpo: `type`, `processing_mode`, `external_reference` (UUID del intento), `description` (`"Pedido #<id> - FoodStore"`, en la raíz [S2]), `total_amount` y `transactions.payments[0].amount` como **texto** con 2 decimales (`str(total.quantize(Decimal("0.01"), ROUND_HALF_UP))`, p. ej. `"1500.50"`; Orders los define como string y `total_amount` debe igualar la suma de las transacciones [S2]), `payment_method {id: payment_method_id, type: payment_type_id, token, installments}` [S1][S2], `payer {email, identification?}` [S2]. Sin `notification_url` (no existe en Orders [S2]), sin `issuer_id` (Orders no documenta un campo `issuer_id` directo [S2]), sin `expiration_time` (no se envía en modo automático [S1]) y sin `capture_mode` (OQ-16). Desaparece el `float` y el `DeprecationWarning` silenciado.
Contrato `CrearPagoRequest` (sigue `extra="forbid"`): agrega **`payment_type_id: Literal["credit_card", "debit_card"]` obligatorio**, porque `payment_method.type` es obligatorio en Orders y el brick lo entrega en `additionalData.paymentTypeId` [S1][S9] (OQ-10). `issuer_id` se sigue **aceptando y no se reenvía**, para que el `formData` del brick pase tal cual (OQ-11).

**D19 — Traducción de respuestas HTTP de MercadoPago en el adaptador.**
| MercadoPago responde | Adaptador | Service / HTTP |
|---|---|---|
| 200/201 con orden | `ResultadoMP` | T2 aplica (D7) → 201 |
| 402 con orden `failed` en el cuerpo (raíz o bajo `data`, junto a `errors`) [S8] | `ResultadoMP` (no es excepción) | T2 → 201 `rechazado` con el `status_detail` de la transacción |
| 401 / 403 | `CredencialesMPRechazadas` | D25 → 503 |
| 409 `idempotency_key_already_used` [S7] | `buscar_por_referencia(external_reference)`; si la encuentra → `ResultadoMP`; si no → `MercadoPagoNoDisponible` | 201 o 502 (D22) |
| 423 `resource_locked` («Idempotency Key Locked») [S7] | `MercadoPagoNoDisponible` | 502, intento reutilizable |
| otro 4xx (`property_value`, `required_properties`, `unsupported_properties`, `invalid_total_amount`, …) [S7] | `PagoRechazadoPorMP(causa)` con el `code` del primer error | 400 `HTTP_400` e intento `rechazado` (sin cambios) |
| 5xx, `OSError`/`ValueError`/`MercadoPagoError` | `MercadoPagoNoDisponible` | 502 (sin cambios) |
`causa` se toma de `errors[0].code` (Orders devuelve una **lista** con todos los errores de validación [S2]) y se acota a 100. Nunca se registra el token de la tarjeta, el access token ni el cuerpo enviado. *Nota:* `idempotency_validation_failed` (400) es transitorio según MercadoPago y pide **otra** clave [S7]: cae en «otro 4xx» → intento `rechazado` → el siguiente `crear` usa claves nuevas, que es justo lo que pide la doc.
*No confirmado:* la forma exacta del 402 en Checkout API online (el sandbox vio una orden creada; la doc muestra `{errors, data}` para captura manual) → **OQ-15**: el adaptador acepta ambas.

**D20 — Mapeo de estados de la orden a estados locales (ajusta `_estado_local_para`).**
Se mapea el `status` de la **orden** [S3]:
| `status` de la orden | Estado local |
|---|---|
| `processed` (`accredited`; también `partially_refunded`) | `aprobado` |
| `failed` (cualquier detalle), `canceled` (`canceled`/`expired`), `refunded`, `charged_back` | `rechazado` (mismo criterio que hoy con `rejected`/`cancelled`/`refunded`/`charged_back`; reembolsos siguen en PA-08) |
| `created`, `processing` (`in_process`, `pending_review_manual`), `action_required` (`waiting_payment`, `waiting_capture`, `pending_challenge`, …) | `pendiente` |
| cualquier otro | sin mapeo: crear lo deja `pendiente` con `mp_status` registrado; el webhook responde `ignored` (sin cambios de conducta) |
`processing` puede volver en la creación cuando el pago es asincrónico [S3] (el sandbox vio `capture_mode: automatic_async` por defecto) → queda `pendiente` con `mp_order_id` y lo resuelve el webhook. `action_required`/`pending_challenge` es 3DS [S10]: fuera de alcance, queda `pendiente` y MercadoPago lo cierra (`failed`/`canceled` `expired` a los 40 min [S10]) → **OQ-16**.
`mp_status` guarda el estado de la orden; `mp_status_detail`, el de la transacción (D17). Los valores expuestos por la API pasan a ser los de Orders (`processed`/`accredited`, `failed`/`insufficient_amount`, `processing`/`in_process`).

**D21 — Identidad de MercadoPago en `pagos`: migración `004_pagos_orders_api`.**
Los ids de Orders son alfanuméricos (`ORD…`, `PAY…`) [S1], incompatibles con `mp_payment_id BIGINT`. Upgrade (a mano, nombres explícitos): `ADD COLUMN mp_order_id VARCHAR(64) NULL` + `UNIQUE` `uq_pagos_mp_order_id`; `ALTER COLUMN mp_payment_id TYPE VARCHAR(64) USING mp_payment_id::text` (conserva su unicidad y los valores numéricos existentes como texto); `DROP COLUMN mp_merchant_order_id` (Orders no usa merchant orders y su tópico no es compatible [S12]). Downgrade: `mp_payment_id` vuelve a `BIGINT` con `USING CASE WHEN mp_payment_id ~ '^[0-9]+$' THEN mp_payment_id::bigint END` (los `PAY…` se pierden), re-agrega `mp_merchant_order_id BIGINT NULL` vacía, `DROP` de `uq_pagos_mp_order_id` y `mp_order_id`. Modelo: `mp_order_id: str | None (max 64, unique)`, `mp_payment_id: str | None (max 64, unique)`.
*Por qué columna nueva y no reutilizar `mp_merchant_order_id`:* la orden es la identidad que firma y notifica el webhook (D23) y la que deduplica; necesita unicidad y tipo texto. Reutilizar la columna `BIGINT` exigiría cambiarle tipo y significado a la vez. *Alternativa:* dejar `mp_payment_id` intacto y sumar `mp_transaction_id`; descartada porque dejaría una columna muerta y dos nombres para lo mismo. **OQ-9.**
`decidir_intento` pasa a leer `mp_order_id` («en proceso en MercadoPago» = `pendiente` **con** orden creada); `decidir_transicion_pago` compara ids de orden de texto.

**D22 — Idempotencia y reintento con Orders (ajusta D6).**
Se conserva: `X-Idempotency-Key` = `intento.idempotency_key` (UUID, obligatorio en Orders [S1]) y la reutilización del intento tras un resultado desconocido. Cambia lo que pasa si la primera llamada sí llegó: la doc de Orders documenta **409 `idempotency_key_already_used`** para una clave ya usada [S7] (en Payments se asumía que devolvía el pago original). Entonces, ante 409, el adaptador busca la orden por `external_reference` (`sdk.order().search({"external_reference": …})` [SDK]) y devuelve ese resultado; T2 lo aplica como cualquier otro. Si no la encuentra, `MercadoPagoNoDisponible` → 502 e intento reutilizable; el webhook (D23) igual la asocia por `external_reference` cuando llegue. *No confirmado:* si una clave repetida con **el mismo cuerpo** devuelve la orden original en vez de 409, y el nombre exacto del filtro de búsqueda (el SDK lo nombra `external_reference` en su docstring; la referencia de «Search order» no se pudo leer) → **OQ-14**.

**D23 — Webhook por tópico `order` (ajusta C-05 y D9).**
- Configuración: en el panel de la aplicación, «Configuración de Webhooks», modo Prueba/Producción, URL HTTPS y evento **«Order (Mercado Pago)»**; guardar genera la clave secreta (`MP_WEBHOOK_SECRET`) [S4]. Los tópicos `payment` y `merchant_order` no son compatibles con Orders [S12].
- Notificación: query `data.id=<ORD…>&type=order`; cuerpo con `type: "order"`, `action` (p. ej. `order.processed`) y `data` con `id`, `external_reference`, `status`, `status_detail`, `transactions.payments[]` [S4]. Hay que responder 200/201 en 22 s; si no, reintenta cada 15 min [S4].
- Firma: mismo manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con pares omitidos si faltan y HMAC-SHA256 hex [S5]. La doc indica que un `data.id` alfanumérico en mayúsculas debe usarse **en minúsculas** para validar (`ORD01JQ…` → `ord01jq…`) [S6], mientras el validador del SDK usa el valor «exactly as received» [SDK]. `verificar_firma_webhook` valida con `data.id` en minúsculas y, si falla, con el valor tal cual (ambas variantes son HMAC con la clave secreta; no debilita la verificación) → **OQ-13**, se confirma en sandbox.
- Proceso: `type`/`topic` ≠ `order` → 200 `ignored` (también `payment`); `data.id` es texto (ya no se convierte a `int`; vacío → `ignored`; query ≠ cuerpo → 400 como hoy); sin `MP_ACCESS_TOKEN` → 503; `PasarelaMercadoPago.consultar_orden(data.id)` (`GET /v1/orders/{id}`, que reemplaza `/v1/payments/{id}` para consultar notificaciones [S2]) → no-200 → 502; se resuelve el pago local con bloqueo por `mp_order_id` → `external_reference` UUID (D9) → no encontrado `ignored`; se aplica con `_aplicar_resultado_mp` (D7) usando el id de orden como identidad de dedupe. Se eliminan `get_by_mp_merchant_order_id*` y la rama por merchant order.
- No se usa el estado que viene en el cuerpo: siempre se consulta la orden (el cuerpo no está firmado; solo `data.id` lo está).

**D24 — Resolución de OQ-3: sin `notification_url`; se retira `MP_NOTIFICATION_URL` (reemplaza D10).**
Orders no tiene `notification_url`: las notificaciones se configuran en «Integraciones» [S2][S4]. `MP_NOTIFICATION_URL` queda sin uso, así que pasa a variables retiradas (`backend-config`), sale de `Settings`, de `.env.example`, de `.env.test.example`, de `settings_env.py` y del README; el 503 de crear solo exige `MP_ACCESS_TOKEN` (`backend-runtime`). La URL del webhook se documenta en `sandbox/README.md` y en la KB como configuración del panel. **OQ-12** (alternativa: conservarla como dato documental; descartada por la regla «toda variable explícita y usada»).

**D25 — Credenciales rechazadas por MercadoPago ≠ datos rechazados.**
401/403 de MercadoPago al crear (en Orders, `unauthorized`/`invalid_credentials` [S2]) → `CredencialesMPRechazadas` → `AppError(503, "HTTP_503", "MercadoPago rechazó las credenciales configuradas (MP_ACCESS_TOKEN)")`, `field` nulo. El intento **no** se marca `rechazado`: queda `pendiente` sin `mp_order_id` (MercadoPago no creó nada) y el siguiente `crear` lo reutiliza con la misma clave, lo que es seguro porque esa clave nunca llegó a procesarse. Se loguea a nivel `ERROR` el status HTTP y el `code` de MercadoPago (sin token ni cuerpo). En el webhook, un 401/403 al consultar la orden → 503 (MercadoPago reintenta), no 502. *Por qué 503 y no 502:* no es una falla transitoria del proveedor sino configuración del backend inutilizable, igual que el 503 «MercadoPago no configurado»; el frontend (C-20) muestra «pagos no disponibles». **OQ-17.** Los 4xx de datos siguen respondiendo 400 «MercadoPago rechazó los datos del pago».

**D26 — Contrato de respuesta.**
`PagoCrearResponse{pago_id, pedido_id, estado, mp_order_id, mp_payment_id: str | None, mp_status, mp_status_detail}`; `PagoEstadoResponse` no cambia de campos (sus valores pasan a los de Orders). C-20 todavía no consume el contrato, así que el cambio de tipo no rompe código existente.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-11. Cambio solo de backend; la pantalla de checkout con el brick es C-20.
- Mockups: n/a
- Approval: n/a
- Preview: n/a
- Visual verify: n/a

## Risks / Trade-offs

- **[Doble cobro por concurrencia o timeout]** → D4 bloquea el pedido en T1 y D6 reutiliza la `idempotency_key` tras un resultado desconocido. Riesgo residual: MercadoPago conserva las claves de idempotencia un tiempo acotado; un reintento muy tardío sobre un intento desconocido podría cobrar de nuevo. Mitigación: el webhook asocia cualquier cobro por `external_reference` y un segundo aprobado del mismo pedido queda `a_devolver` (C-05 D7).
- **[Misma clave con otro token]** → si MercadoPago respondiera error a una clave repetida con cuerpo distinto (en vez de devolver el pago original), el reintento tras 502 fallaría con 4xx → el intento pasa a `rechazado` y el siguiente `crear` usa claves nuevas. Se verifica en sandbox (tarea 8).
- **[Carrera crear ↔ webhook]** → T2 y el webhook bloquean la misma fila y deciden con `decidir_transicion_pago`; el segundo en llegar ve `already_processed`. Cubierto por test.
- **[Notificaciones de `notification_url` sin firma]** → OQ-3; si ocurre, el webhook responde 401 y MercadoPago reintenta; los pagos aprobados en la creación igual quedan confirmados (D7), pero los `in_process` dependen del webhook.
- **[Pagos heredados]** → tras la `003`, los `pendiente` de Checkout Pro sin `mp_payment_id` ya no se encuentran por `external_reference` (cambió); dev/sandbox solamente, sin datos productivos.
- **[Downgrade con pérdida]** → la `002` recupera el esquema pero no los valores de preferencia ni las referencias numéricas. Aceptado y documentado.
- **[SDK con `DeprecationWarning`]** → silenciado en el adaptador; si el SDK lo vuelve error en una versión futura, aplica OQ-3. *(Resuelto por D24: Orders no envía `notification_url`.)*

Riesgos de la revisión 2026-11-15 (Orders API):
- **[Reintento con clave ya usada]** → si MercadoPago responde 409 a la clave repetida y la búsqueda por `external_reference` no encuentra la orden (indexación tardía), el reintento responde 502 y el intento sigue reutilizable; el webhook `order` lo resuelve por `external_reference`. Riesgo residual: el usuario ve 502 aunque el cobro se haya hecho; el `GET /pagos/{pedido_id}` posterior muestra el estado real. OQ-14.
- **[Firma de ids alfanuméricos]** → si la variante de `data.id` (minúsculas vs tal cual) no es la que firma MercadoPago, todo webhook da 401 y MercadoPago reintenta; los cobros aprobados en la creación igual confirman el pedido (D7), pero `processing` dependería del webhook. Se prueban ambas variantes (D23) y se confirma en 10.2. OQ-13.
- **[Pago asincrónico]** → con `capture_mode` por defecto `automatic_async`, la creación puede volver `processing` y la confirmación depende del webhook. Cubierto por D20 (`pendiente`) y por el webhook; OQ-16.
- **[402 con forma distinta]** → si el 402 no trae la orden en ninguna de las dos formas aceptadas, el adaptador lo trata como «otro 4xx» (400 e intento `rechazado`): no hay doble cobro (la orden `failed` no cobró), solo un mensaje menos preciso. OQ-15.
- **[Downgrade de la `004`]** → los `mp_payment_id` `PAY…` y los `mp_order_id` se pierden al volver a `003`. Aceptado: dev/sandbox.
- **[Cuenta de prueba]** → que `/v1/payments` rechace la cuenta `test_user` es un hecho observado, no documentado; Orders es igualmente el camino recomendado [S2], así que la decisión no depende de esa causa.

## Migration Plan

1. Usuario aprueba proposal/design/specs y responde OQ-1..OQ-8 (o acepta los defaults).
2. Apply con TDD (tasks.md); `alembic upgrade head` lleva dev y test a `003`.
3. Quitar `BACKEND_PUBLIC_URL` y `FRONTEND_URL` del `.env` local (el usuario) y de `.env.example` (con autorización).
4. Verificación manual en sandbox (tarjetas de prueba con vencimiento futuro, ngrok): aprobado, rechazado, reintento, firma del webhook.
Rollback: `alembic downgrade 002` y revertir el commit del change.

Revisión 2026-11-15 (Orders API):
1. Usuario aprueba esta revisión (proposal, D16..D26, specs) y responde OQ-9..OQ-17 (o acepta los defaults).
2. Apply con TDD (tasks.md §11–§17); `alembic upgrade head` lleva dev y test a `004`.
3. El usuario quita `MP_NOTIFICATION_URL` de `backend/.env` y `backend/tests/.env.test` (y autoriza editar los `.example`), y configura en el panel de MercadoPago, modo Prueba, el Webhook con el evento «Order (Mercado Pago)» hacia `<ngrok>/api/v1/pagos/webhook`, copiando la clave secreta en `MP_WEBHOOK_SECRET`.
4. Verificación manual en sandbox (10.2 reformulada). Rollback: `alembic downgrade 003` y revertir los commits de la revisión.

## Open Questions

Todas tienen un default aplicado en specs y tasks; **la aprobación del change implica aceptar los defaults** salvo que el usuario indique otra cosa (gobernanza CRÍTICA: se responden antes de apply).

- **OQ-1 (D1):** ¿Payments API (`/v1/payments`) en lugar de Orders API? Default: **Payments**. Cambiarlo rehace webhook, tabla y specs.
- **OQ-2 (D3):** ¿`payer.email` lo envía el brick (obligatorio en el body) o se usa el email de la cuenta del dueño del pedido? Default: **del brick**.
- **OQ-3 (D10):** ¿Se envía `notification_url` por pago (default) o solo Webhooks del panel (y se retira `MP_NOTIFICATION_URL`)? Se confirma en sandbox.
- **OQ-4 (D12):** ¿Se eliminan `mp_preference_id`/`mp_init_point`? Default: **sí**.
- **OQ-5 (D7):** ¿Un pago aprobado en la creación confirma el pedido en ese mismo request? Default: **sí** (mismo camino que el webhook).
- **OQ-6 (D6):** ¿Tras un 502 el reintento reutiliza el intento y su `X-Idempotency-Key`? Default: **sí**.
- **OQ-7 (D12):** ¿Las filas existentes reciben UUID nuevos (perdiendo la referencia numérica)? Default: **sí**.
- **OQ-8 (D5):** ¿Código propio `PAYMENT_NOT_ALLOWED` (409) evaluado antes del 503? Default: **sí**.

**Respuesta del usuario (2026-11-11):** OQ-1..OQ-8: aceptados los defaults (2026-11-11, por el usuario). OQ-3 se confirma igualmente en sandbox (tarea 10.2).

**Revisión 2026-11-15:** OQ-1 se reabre y se responde por la evidencia del sandbox: **Orders API** (D16). OQ-3 se resuelve por documentación: Orders no tiene `notification_url` → se retira `MP_NOTIFICATION_URL` (D24, confirmar en OQ-12). OQ-2 y OQ-4..OQ-8 siguen vigentes.

Preguntas nuevas (gobernanza CRÍTICA: se responden antes de apply; los defaults ya están aplicados en specs y tasks):

- **OQ-9 (D21):** ¿Migración `004` con `mp_order_id VARCHAR(64)` único, `mp_payment_id` → `VARCHAR(64)` y sin `mp_merchant_order_id`? Default: **sí**. Alternativa: conservar `mp_payment_id BIGINT` sin uso y sumar `mp_transaction_id`.
- **OQ-10 (D18):** ¿`payment_type_id` (`credit_card`/`debit_card`) obligatorio en `POST /pagos/crear`, tomado de `additionalData.paymentTypeId` del brick? Default: **obligatorio**. Alternativa: opcional con `credit_card` por defecto (falla con tarjetas de débito).
- **OQ-11 (D18):** ¿`issuer_id` se acepta y se ignora (no existe en Orders)? Default: **aceptar e ignorar**. Alternativa: sacarlo del contrato (el `formData` del brick daría 422 si lo incluye).
- **OQ-12 (D24):** ¿Se retira `MP_NOTIFICATION_URL` y el webhook se configura solo en el panel? Default: **retirar**.
- **OQ-13 (D23):** ¿La firma de notificaciones `order` se valida con `data.id` en minúsculas (doc [S6]) y, si falla, tal cual (validador del SDK)? Default: **ambas variantes, minúsculas primero**; en 10.2 se registra cuál firmó MercadoPago y se deja solo esa.
- **OQ-14 (D22):** Ante 409 `idempotency_key_already_used`, ¿se reconcilia buscando la orden por `external_reference`? Default: **sí**; en 10.2 (o con un caso dirigido) se confirma si una clave repetida devuelve 409 o la orden original y el nombre del filtro de búsqueda.
- **OQ-15 (D19):** ¿Un 402 con la orden `failed` (en la raíz o bajo `data`) se trata como resultado `rechazado` (201) y no como error? Default: **sí, aceptando ambas formas**.
- **OQ-16 (D18, D20):** ¿Se omite `capture_mode` (MercadoPago usa `automatic_async`) y `processing`/`action_required` (incluido 3DS `pending_challenge`) quedan `pendiente` hasta el webhook, sin flujo de challenge? Default: **sí**; el challenge 3DS queda fuera de alcance (C-20 / change futuro).
- **OQ-17 (D25):** ¿Credenciales rechazadas por MercadoPago responden 503 `HTTP_503` (no 502 ni 400) dejando el intento reutilizable? Default: **503**.

**Respuesta del usuario (2026-11-16):** OQ-9..OQ-17: aceptados los valores recomendados (defaults), por el usuario. Nota de contexto: al crear una aplicación nueva en MercadoPago, el panel ofrece «API de Orders» frente a «API de Payments» y rotula Payments como «Esta API será descontinuada pronto»; el usuario crea la aplicación con API de Orders (refuerza D16). OQ-13 y OQ-14 se siguen confirmando en sandbox (10.2).

**Avance 2026-11-16:** OQ-13 resuelta por observación (firma con `data.id` en minúsculas; ver «Resultado de la verificación manual en sandbox — parcial»). OQ-14 sigue abierta.

## Verify (2026-11-16)

Verificación independiente (solo lectura) contra specs, diseño, tareas y reglas duras: **PASS WITH FINDINGS**. Sin hallazgos blocker ni major.

- Suite completa del backend: 1669 passed, 0 failed. `openspec validate c-12-pagos-checkout-api-cardpayment --strict`: válido.
- Sin restos de la integración anterior en `backend/app` (`payment()`, `merchant_order`, `notification_url`, `MP_NOTIFICATION_URL`, `/v1/payments`, `BACKEND_PUBLIC_URL`, `FRONTEND_URL`).
- Seguridad (gobernanza CRÍTICO): PCI SAQ-A (`extra="forbid"`), firma con comparación en tiempo constante, el webhook nunca confía en el cuerpo, idempotencia y atomicidad pago + pedido + stock, autorización 404 → 403 → 409 → 503, sin secretos en logs ni respuestas. Todo en regla.
- No verificado: archivos `.env*` (se apoya en `test_env_example.py`), llamadas reales a MercadoPago (se toman los resultados de sandbox de arriba), cobertura medida.

Hallazgos menores, derivados a changes futuros por decisión del usuario (2026-11-16; ver «Heredado de C-12» en CHANGES.md):

1. Faltan tests directos del mapeo de estados `canceled`, `charged_back` y `created`.
2. `partially_refunded → aprobado` está en D20 y en el código, pero no en la spec, y no tiene test.
3. La respuesta 200 del webhook serializa el `PedidoDetalle` completo (la spec solo pide `status`).
4. `procesar_webhook` y su handler son `async def` pero hacen I/O bloqueante (SDK y base): bloquean el event loop.
5. El webhook no compara el `total_amount` de la orden con el monto del pago local (endurecimiento, no exigido por la spec).
6. KB `04` omitía el estado `a_devolver` de `Pago`: **corregido** antes de archivar.
7. La ausencia de secretos en logs se prueba solo a nivel del adaptador, no por el endpoint.

Pendientes de la verificación manual que quedan abiertos: OQ-14 (clave de idempotencia repetida) y los casos `OTHE` y `CONT`; y decidir si se retira la variante «tal cual» de la firma (OQ-13 observó que MercadoPago firma con el id en minúsculas).
