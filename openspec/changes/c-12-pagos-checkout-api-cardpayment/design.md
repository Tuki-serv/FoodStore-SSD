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

**Non-Goals:** frontend del brick (C-20); otros medios del Payment Brick (efectivo en Rapipago/Pago Fácil, cuenta MP) y 3DS/challenge; Orders API (D1); reembolsos o reacción a `refunded`/`cancelled` (PA-08); ventana de tolerancia del `ts` de la firma (C-05 D3); cola asíncrona; tocar `MP_PUBLIC_KEY` (sale de la respuesta de crear porque el brick la necesita antes de tokenizar; C-20 decide si el frontend la lee de `VITE_*` o de un endpoint).

## Decisions

**D1 — Checkout API sobre el recurso Payments (`/v1/payments`), no Orders API.**
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

**D10 — `notification_url` por pago.**
Se envía `notification_url = MP_NOTIFICATION_URL` tal cual (sin derivarla) para que el sandbox con ngrok funcione sin depender del panel. El `DeprecationWarning` del SDK se silencia solo en el adaptador (`warnings.catch_warnings`) para no ensuciar la suite. **OQ-3:** verificar en sandbox que esas notificaciones llegan con `x-signature`; si no, quitar `notification_url`, configurar Webhooks en el panel y retirar `MP_NOTIFICATION_URL` (cambiaría specs `backend-config`/`backend-runtime`).

**D11 — Monto exacto.** `pedido.total` (`Decimal`) se cuantiza a `0.01` con `ROUND_HALF_UP` y se convierte a `float` **solo en el adaptador** (el SDK serializa con `json`, que no acepta `Decimal`). `transaction_amount` del intento guarda el `Decimal`.

**D12 — Migración `003_pagos_checkout_api`** (a mano, nombres explícitos):
upgrade: `UPDATE pagos SET external_reference = gen_random_uuid()::text` (todas las filas: ninguna tiene hoy un UUID, son ids de pedido o `NULL`) → `ALTER COLUMN external_reference TYPE uuid USING external_reference::uuid` → `SET NOT NULL` → `CREATE UNIQUE CONSTRAINT uq_pagos_external_reference` → `DROP COLUMN mp_preference_id, mp_init_point`.
downgrade: `DROP CONSTRAINT` → `TYPE VARCHAR(100) USING external_reference::text` → `DROP NOT NULL` → re-agrega `mp_preference_id VARCHAR(255) NULL` y `mp_init_point VARCHAR(500) NULL` (vacías). No restaura las referencias numéricas ni las preferencias (pérdida aceptada: datos de Checkout Pro sin uso). `gen_random_uuid()` es nativa en PostgreSQL ≥ 13 (el proyecto usa 15). **OQ-4** (conservar las columnas de preferencia) y **OQ-7** (rellenar con UUID nuevos).

**D13 — Consulta.** `PagoEstadoResponse{pedido_id, pago_id, estado, mp_status, mp_status_detail}` del último intento (`get_ultimo_by_pedido`, orden `created_at DESC, id DESC`); nulos sin intentos.

**D14 — Retiro de Checkout Pro.** Se borran `router.mp_redirect`, `_crear_preferencia_mp`, `BACKEND_PUBLIC_URL` y `FRONTEND_URL` de `Settings`, de `tests/support/settings_env.py` (pasan a `RETIRED_VARS`), del README y de `.env.example` (este último **requiere autorización explícita** del usuario, como en C-05). Los imports de `RedirectResponse`, `urllib.parse` y `HTTPException` salen del router/service.

**D15 — Sin cambios en `order-lifecycle`, `order-stock` ni el seed.** La confirmación por pago aprobado sigue siendo `confirmar_por_pago_aprobado` (actor Sistema); `TARJETA` sigue deshabilitada (C-07).

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
- **[SDK con `DeprecationWarning`]** → silenciado en el adaptador; si el SDK lo vuelve error en una versión futura, aplica OQ-3.

## Migration Plan

1. Usuario aprueba proposal/design/specs y responde OQ-1..OQ-8 (o acepta los defaults).
2. Apply con TDD (tasks.md); `alembic upgrade head` lleva dev y test a `003`.
3. Quitar `BACKEND_PUBLIC_URL` y `FRONTEND_URL` del `.env` local (el usuario) y de `.env.example` (con autorización).
4. Verificación manual en sandbox (tarjetas de prueba con vencimiento futuro, ngrok): aprobado, rechazado, reintento, firma del webhook.
Rollback: `alembic downgrade 002` y revertir el commit del change.

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
