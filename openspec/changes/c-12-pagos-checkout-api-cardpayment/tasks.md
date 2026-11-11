# Tasks — C-12 `pagos-checkout-api-cardpayment`

> **Governance CRÍTICO** (pagos): NO escribir código hasta que el usuario apruebe explícitamente `proposal.md`, `design.md` y las specs, y responda (o acepte por defecto) OQ-1..OQ-8 de `design.md`. Si una respuesta cambia un default, actualizar specs/design/tasks antes de aplicar.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por la interfaz HTTP (o la API pública de la función de decisión / del adaptador), valores esperados escritos a mano (nunca recalculados como lo hace el código), sin aserciones tautológicas. Mocks **solo en el borde**: `mercadopago.SDK` (con el `MPFalso` extendido en 4.1). La firma del webhook no se mockea (`mp_firma.firmar`).
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Capas `models ← repository ← unit of work ← services ← routers`; el router solo valida y delega (sin `Session`); no duplicar CRUD (extender `BaseRepository`). Todo cambio de esquema por Alembic (`003`). No leer/escribir `.env*` salvo autorización explícita (2.4), no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 Registrar en `design.md` §Open Questions la respuesta del usuario a OQ-1..OQ-8 con fecha (o «default aceptado»). Verificar con `grep -n "OQ-[1-8]" openspec/changes/c-12-pagos-checkout-api-cardpayment/design.md`.
- [x] 0.2 Correr la suite completa y registrar total/passed/failed (baseline post-C-11). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.

## 1. Migración 003 y modelo `Pago` (D9, D12; spec `backend-db-migrations`)

- [x] 1.1 RED: en `tests/integration/test_migrations.py`, test de la `003` sobre la base de migraciones: tras `upgrade head` la versión es `"003"`, `pagos.external_reference` es `uuid` NOT NULL, existe `uq_pagos_external_reference` y no existen `mp_preference_id`/`mp_init_point`. Ejecutar → falla (cabeza `002`).
- [x] 1.2 GREEN: `alembic/versions/003_pagos_checkout_api.py` (revisada a mano, `down_revision='002'`, pasos de D12) y modelo `Pago` (`external_reference: UUID` con `default_factory=uuid4`, `UniqueConstraint(name="uq_pagos_external_reference")`, sin columnas de preferencia). Actualizar a `"003"` los tests que fijan la cabeza (`test_current_and_head_*`, `test_foodstore_test_queda_en_head_*`, `test_upgrade_de_001_a_002_*` pasa a `upgrade 002`) y el escenario «Esquema tras el upgrade» de la `002` a `alembic upgrade 002`. Ejecutar `pytest tests/integration/test_migrations.py` → verde.
- [x] 1.3 TRIANGULATE: (a) sobre una base en `002` con un pago `external_reference="42"` y otro `NULL`, `upgrade 003` deja dos UUID distintos y el resto de columnas igual; (b) insertar dos pagos con la misma referencia → `IntegrityError` nombrando `uq_pagos_external_reference`; (c) `downgrade 002` → `VARCHAR(100)` nullable, sin la restricción, con `mp_preference_id`/`mp_init_point` vacíos; (d) ida y vuelta sin diferencias con los modelos. Ejecutar → verde.
- [x] 1.4 Actualizar `tests/support/schema_expectations.py` si lista columnas de `pagos`, y `tests/support/pagos_factory.py` (sin `external_reference` explícita: la genera el modelo). Ejecutar `pytest tests/integration/test_schema_spec_corrections_db.py tests/integration/test_pago_webhook_fsm.py` → verde.

## 2. Configuración y códigos de error (D8, D14; specs `backend-config`, `api-conventions`)

- [x] 2.1 RED: en `tests/unit/test_config.py`, con `BACKEND_PUBLIC_URL` y `FRONTEND_URL` en el entorno la configuración no expone esos atributos y `MP_NOTIFICATION_URL` es exactamente la provista; sin `MP_NOTIFICATION_URL` vale `None` aunque haya `BACKEND_PUBLIC_URL`. Reemplazar los tests que hoy afirman sus valores. Ejecutar → falla.
- [x] 2.2 GREEN: quitar `BACKEND_PUBLIC_URL` y `FRONTEND_URL` de `core/config.py`; en `tests/support/settings_env.py` sacarlas del entorno completo y sumarlas a `RETIRED_VARS`. Ejecutar `pytest tests/unit/test_config.py` → verde.
- [x] 2.3 RED→GREEN: `ErrorCode.PAYMENT_NOT_ALLOWED` en `core/errors.py`, con un test unitario que fije su valor `"PAYMENT_NOT_ALLOWED"` junto a los demás códigos de negocio si existe ese test de catálogo; si no, lo cubre 5.4 por HTTP. Ejecutar → verde.
- [ ] 2.4 `backend/.env.example`: quitar `BACKEND_PUBLIC_URL` y `FRONTEND_URL`. **Requiere que el usuario lo haga o autorice editarlo.** Agregar ambas a la lista de retiradas de `tests/unit/test_env_example.py`. Verificar `pytest tests/unit/test_env_example.py` → verde.

## 3. Decisión pura del intento de cobro (D5, D6; spec «Precondiciones para cobrar un pedido»)

- [x] 3.1 RED: `tests/unit/test_decision_cobro.py` para `decidir_intento`: pedido `MERCADOPAGO` `PENDIENTE` sin pagos → `CREAR`; pedido `EFECTIVO` `PENDIENTE` → `NO_PERMITIDO`. Ejecutar → falla (no existe).
- [x] 3.2 GREEN: `app/modules/pagos/decision_cobro.py` (pura, type hints, sin I/O). Ejecutar → verde.
- [x] 3.3 TRIANGULATE: `CANCELADO` → `NO_PERMITIDO`; último `rechazado` → `CREAR`; un pago `aprobado` aunque el último sea `rechazado` → `NO_PERMITIDO`; `a_devolver` → `NO_PERMITIDO`; último `pendiente` con `mp_payment_id` → `NO_PERMITIDO`; último `pendiente` sin `mp_payment_id` → `REUTILIZAR`; `TRANSFERENCIA` → `NO_PERMITIDO`. Ejecutar → verde.

## 4. Adaptador de MercadoPago (D2, D10, D11)

- [x] 4.1 Extender `tests/support/mp_webhook.py::MPFalso` con `create(datos, request_options)` que registra cuerpo y headers (`x-idempotency-key`) y devuelve la respuesta configurada con `responder_creacion(status_http, estado, detalle, payment_id)` o lanza la excepción configurada (p. ej. `OSError`). Sin cambiar el comportamiento de `get`. Verificar `pytest tests/integration/test_pago_webhook_fsm.py` → verde.
- [x] 4.2 RED: `tests/unit/test_pasarela_mp.py`: `crear_pago` con total `Decimal("1500.50")` envía `transaction_amount` 1500.5, `token`, `payment_method_id`, `installments`, `issuer_id`, `payer.email`, `external_reference`, `notification_url` y el header `x-idempotency-key` igual a la clave pasada; con respuesta 201 `approved`/`accredited` devuelve `mp_status="approved"`, `mp_status_detail="accredited"`. Ejecutar → falla (no existe).
- [x] 4.3 GREEN: `app/modules/pagos/pasarela_mp.py` (`PasarelaMercadoPago`, `ResultadoMP`, `PagoRechazadoPorMP`, `MercadoPagoNoDisponible`; `DeprecationWarning` de `notification_url` silenciado localmente; nunca loguea el token de tarjeta ni el access token). Ejecutar → verde.
- [x] 4.4 TRIANGULATE: respuesta 400 → `PagoRechazadoPorMP` con la causa; 500 → `MercadoPagoNoDisponible`; `OSError` → `MercadoPagoNoDisponible`; `Decimal("0.10")` → 0.1; `consultar_pago` 200 → `ResultadoMP` (con `merchant_order_id` desde `order.id` o `merchant_order_id`), no-200 → `MercadoPagoNoDisponible`. Ejecutar → verde.
- [x] 4.5 REFACTOR: el webhook usa `PasarelaMercadoPago.consultar_pago` (se borra `_consultar_pago_mp`), mapeando `MercadoPagoNoDisponible` a `AppError(502, "HTTP_502", ...)`. `PaymentService` recibe la fábrica inyectable de la pasarela. Ejecutar `pytest tests/integration/test_pago_webhook_*.py tests/integration/test_pago.py` → verde.

## 5. `POST /pagos/crear` con token de tarjeta (D3, D4, D5, D7, D8; specs `payment-api`, `backend-runtime`, `api-conventions`)

- [x] 5.1 RED: nuevo `tests/integration/test_pago_checkout_api.py` (MP configurado por `monkeypatch`, `MPFalso` parcheado en el borde): el dueño de un pedido `MERCADOPAGO` `PENDIENTE` de 2 u. de un producto con stock 5 crea el pago con los datos del brick y MercadoPago responde `approved`/`accredited` → 201 con `estado` `aprobado`, `mp_status_detail` `accredited`, `mp_payment_id`; sin `preference_id`/`init_point`/`public_key`; pedido `CONFIRMADO`, una fila de historial hacia `CONFIRMADO` con `usuario_id` nulo, stock 3. Ejecutar → falla.
- [x] 5.2 GREEN: `schemas.py` (`CrearPagoRequest` con `extra="forbid"`, `PagadorRequest`, `PagoCrearResponse` nuevo); `PedidoRepository.get_for_update` — si se agrega como genérico en `BaseRepository`, que `ProductoRepository` lo reutilice (regla dura 3); `PaymentService.crear_pago` con T1 → pasarela → T2 y `_aplicar_resultado_mp` extraído del webhook (D7); router delgado. Ejecutar → verde.
- [x] 5.3 TRIANGULATE (resultado): `rejected`/`cc_rejected_insufficient_amount` → 201 `rechazado`, pedido `PENDIENTE`, stock intacto; `in_process`/`pending_contingency` → 201 `pendiente` con `mp_payment_id`; aprobado sin stock → 201 `a_devolver`, pedido `CANCELADO` «Sin stock»; el header `x-idempotency-key` y la `external_reference` enviados son los de la fila (formato UUID); webhook firmado posterior del mismo pago aprobado → 200 `already_processed`, historial y stock sin cambios. Ejecutar → verde.
- [x] 5.4 TRIANGULATE (precondiciones y orden): `EFECTIVO` → 409 `PAYMENT_NOT_ALLOWED`, sin filas nuevas y `MPFalso` sin llamadas; `CANCELADO` → 409; pedido con pago `aprobado` → 409 y sigue un solo pago; último `pendiente` con `mp_payment_id` → 409; `EFECTIVO` sin `MP_ACCESS_TOKEN` → 409 (no 503); cliente B sobre pedido pagado de A → 403 (no 409). Ejecutar → verde.
- [x] 5.5 TRIANGULATE (contrato): sin `token` → 422 `field` `token`; `installments` 0 → 422 `field` `installments`; `card_number` extra → 422; en los tres, sin filas en `pagos` y sin llamadas a MercadoPago. Ejecutar → verde.
- [x] 5.6 TRIANGULATE (503, `backend-runtime`): sin `MP_ACCESS_TOKEN` → 503 `HTTP_503`, `field` nulo, `detail` con `MP_ACCESS_TOKEN`, sin filas; sin `MP_NOTIFICATION_URL` → `detail` la nombra; sin ambas → nombra las dos; `BACKEND_PUBLIC_URL` ya no se exige. Migrar `tests/integration/test_optional_integrations.py` y `test_pago_autorizacion.py` al contrato nuevo (body del brick, `MPFalso.create`, sin `BACKEND_PUBLIC_URL`/`FRONTEND_URL`) sin perder sus casos 401/403/404. Ejecutar → verde.

## 6. Reintentos y errores de MercadoPago (D6, D7; specs «Reintento…», «Datos rechazados por MercadoPago»)

- [x] 6.1 RED: rechazo y reintento con otro token aprobado → 201 `aprobado`; el pedido tiene dos pagos (`rechazado`, `aprobado`) con `idempotency_key` y `external_reference` distintas; pedido `CONFIRMADO`; `GET /pagos/{pedido_id}` devuelve el segundo. Ejecutar → falla o verde por 5.x (si verde, seguir con 6.2, que sí falla).
- [x] 6.2 RED: `MPFalso.create` lanza `OSError` → 502 `HTTP_502`, un pago `pendiente` sin `mp_payment_id`, pedido `PENDIENTE`; segundo `crear` aprobado → 201 `aprobado`, **un solo** pago, y las dos llamadas registradas llevaron el mismo `x-idempotency-key`. Ejecutar → falla.
- [x] 6.3 GREEN: rama `REUTILIZAR` en T1 y mapeo de `MercadoPagoNoDisponible` a 502 sin T2. Ejecutar → verde.
- [x] 6.4 TRIANGULATE: MercadoPago responde 400 → 400 `HTTP_400` con `detail` genérico (sin token ni access token), intento `rechazado` sin `mp_payment_id`, pedido `PENDIENTE`; reintento aprobado → 201 y dos pagos con claves distintas; MercadoPago 500 → 502 e intento reutilizable. Ejecutar → verde.
- [x] 6.5 TRIANGULATE (concurrencia): dos `crear` del mismo pedido desde dos sesiones/conexiones independientes contra `foodstore_test` (patrón de `test_pago_webhook_concurrente.py`) → una sola fila en `pagos` y ambas llamadas a MercadoPago con la misma `x-idempotency-key`. Ejecutar → verde.

## 7. Webhook por referencia externa (D9; spec «El webhook asocia el pago por su referencia externa»)

- [x] 7.1 RED: en `tests/integration/test_pago_webhook_idempotencia.py`, intento 1 `rechazado` (id 600) e intento 2 `pendiente` sin id; notificación firmada del pago 700 `approved` con la referencia del intento 2 → 200 `processed`, intento 2 `aprobado` con id 700, intento 1 intacto, pedido `CONFIRMADO`. Ejecutar → falla o verde por casualidad del «último pago»; agregar el caso 7.2 que sí falla.
- [x] 7.2 RED: notificación del pago 800 `rejected` con la referencia del intento 1 → el intento 1 queda `rechazado` con id 800 y el intento 2 no cambia. Ejecutar → falla (hoy busca el último del pedido).
- [x] 7.3 GREEN: `PagoRepository.get_by_external_reference_for_update(UUID)`; `_resolver_pago_bloqueado` con `mp_payment_id` → referencia UUID (si no parsea, se salta) → `merchant_order_id`; eliminar `get_ultimo_by_pedido_for_update` si queda sin uso. Ejecutar → verde.
- [x] 7.4 TRIANGULATE: referencia `"42"` de un pago desconocido → 200 `ignored`, nada cambia; migrar `tests/integration/test_pago_webhook_*.py` y `tests/support/mp_webhook.py` para que `responder(...)` reciba la `external_reference` UUID del pago (no el id del pedido) sin cambiar sus aserciones de pedido/historial/stock. Ejecutar `pytest tests/integration/test_pago_webhook_*.py` → verde.
- [x] 7.5 TRIANGULATE (carrera crear ↔ webhook): el webhook procesa el pago aprobado (por referencia) antes de que `crear` aplique T2 (simulado: `MPFalso.create` dispara el webhook antes de devolver) → `crear` responde 201 `aprobado`, una sola fila de historial hacia `CONFIRMADO`, stock descontado una vez. Ejecutar → verde.

## 8. Consulta y retiro de Checkout Pro (D13, D14; specs «La consulta del pago expone…», «Rutas públicas de pagos»)

- [x] 8.1 RED: `GET /pagos/{pedido_id}` con último intento `rechazado` (`rejected`, `cc_rejected_bad_filled_security_code`) → 200 con `pago_id`, `estado`, `mp_status`, `mp_status_detail`; pedido sin intentos → los cuatro nulos. Ejecutar → falla.
- [x] 8.2 GREEN: `PagoEstadoResponse` y `obtener_pago`. Ejecutar → verde.
- [x] 8.3 RED→GREEN: `GET /api/v1/pagos/redirect/1/success` → 404 `HTTP_404` sin redirección; borrar `router.mp_redirect`, `_crear_preferencia_mp` e imports muertos; actualizar en `test_pago_autorizacion.py`/`test_optional_integrations.py` los casos del redirect a 404. Verificar con `grep -rn "FRONTEND_URL\|BACKEND_PUBLIC_URL\|init_point\|preference" backend/app` → sin resultados. Ejecutar → verde.
- [x] 8.4 REFACTOR + revisión SOLID/DRY y capas: router sin lógica ni `Session`; un solo camino de aplicación de estados (D7); sin `HTTPException` en `PaymentService`. Ejecutar `pytest tests/unit tests/integration/test_pago*.py tests/integration/test_optional_integrations.py tests/integration/test_rbac_matriz.py` → verde.

## 9. Documentación (proposal §Impact)

- [x] 9.1 Actualizar `knowledge-base/11` (modalidades, flujo de cobro objetivo = actual, estados, sandbox, riesgos), `07` (Flujo 4 pasos 5–7), `05` (RN-PA-01/02/03), `04` (`Pago`: `external_reference` UUID NN único, sin columnas de preferencia), `08` (variables), `09` (DT-01 y DT-26 resueltas) y `backend/README.md` (variables y 503). Verificar con `grep -rn "init_point\|FRONTEND_URL\|BACKEND_PUBLIC_URL" knowledge-base backend/README.md` → solo menciones históricas marcadas como retiradas.

## 10. Integración

- [ ] 10.1 Suite completa → 0 failed; comparar con el baseline de 0.2 (los tests reemplazados se justifican en el resumen). Ejecutar `openspec validate c-12-pagos-checkout-api-cardpayment --strict` → válido.
- [ ] 10.2 Verificación manual en sandbox (la hace el usuario, con ngrok y credenciales `TEST-…`, tarjetas con vencimiento futuro): aprobado, rechazado (`4000 0000 0000 0002`), reintento, y que la notificación de `notification_url` llega firmada (OQ-3). Registrar el resultado en `design.md`.

## Workflow follow-up

- Verify (`openspec-verify`) contra specs/design/tasks.
- Archivar con `/opsx:archive` y marcar C-12 `[x]` en `CHANGES.md`.
- C-20 (checkout del frontend) consume el contrato nuevo y decide cómo obtiene la `public_key` (ver Non-Goals del design).
