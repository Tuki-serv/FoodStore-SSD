# Tasks — C-05 `pagos-webhook-firma-idempotencia`

> **Governance CRÍTICO** (pagos): NO escribir código hasta que el usuario apruebe explícitamente `proposal.md`, `design.md` y las specs, y responda (o acepte por defecto) OQ-1..OQ-3 de `design.md`. Si una respuesta cambia los defaults, actualizar specs/design/tasks antes de aplicar.
> **Orden:** C-04 (`c-04-pagos-autorizacion-propietario`) SHALL estar aplicado **y archivado** antes de empezar (verificar `openspec/specs/payment-api/spec.md` existe). Todo lo de abajo asume el código posterior a C-04.
> Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR, ejecutando los tests en cada gate. Skills `tdd`, `python-testing-patterns`: AAA, `test_<unidad>_<escenario>_<esperado>`, probar por la interfaz HTTP (o la API pública de la UoW / de la función de decisión), valores esperados escritos a mano, sin aserciones tautológicas. Mocks solo en el borde: `app.modules.pagos.service.mercadopago.SDK` (consulta del pago). **La firma no se mockea**: se calcula con el helper de 1.3. La falla a mitad de transacción se inyecta como en `test_pedidos_fsm.py` (paso de confirmación que falla vía `app.dependency_overrides`).
> Hard rules: PostgreSQL real `foodstore_test` (`docker compose up -d db` desde la raíz); comandos desde `backend/` con `.venv/Scripts/python -m pytest`. Capas `models ← repository ← unit of work ← services ← routers`; el router solo extrae headers/query/cuerpo y delega; sin migraciones (D9): si algo parece necesitarla, frenar y consultar. No leer/escribir `.env*` salvo autorización explícita (1.4), no levantar servidores, no commitear.

## 0. Red de seguridad

- [x] 0.1 Verificar que C-04 está archivado (`ls openspec/specs/payment-api/spec.md` existe y `openspec list --json` no lista C-04 como activo). Si no, frenar.
- [x] 0.2 Correr la suite completa y registrar total/passed/failed (baseline post-C-04). Verificar 0 failed; si algo falla, frenar y reportarlo como preexistente.
- [x] 0.3 Registrar en `design.md` §Open Questions la respuesta del usuario a OQ-1..OQ-3 con fecha. Verificar con `grep -n "OQ-[1-3]" openspec/changes/c-05-pagos-webhook-firma-idempotencia/design.md`.

## 1. Configuración y helper de firma (D1, D2, D10; spec `backend-config`)

- [x] 1.1 RED: en `tests/unit/test_config.py`, cargar `Settings` con `MP_WEBHOOK_SECRET=secreto-de-prueba` → el valor efectivo es exactamente ese; sin la variable → `None`. Ejecutar → falla (no existe el campo).
- [x] 1.2 GREEN: `MP_WEBHOOK_SECRET: Optional[str] = None` en `app/core/config.py` (grupo «Pagos — MercadoPago»). Ejecutar `pytest tests/unit/test_config.py` → verde.
- [x] 1.3 Fijar `mercadopago>=3.6.0` en `requirements.txt` (trae `mercadopago.webhook.WebhookSignatureValidator`) y crear `tests/support/mp_firma.py::firmar(data_id: str | None, request_id: str | None, ts: str, secreto: str) -> dict[str, str]` (HMAC-SHA256 real del manifest `id:…;request-id:…;ts:…;`, omitiendo pares ausentes; devuelve los headers `x-signature`/`x-request-id`). Verificar con `.venv/Scripts/python -c "from mercadopago.webhook import WebhookSignatureValidator"` sin error.
- [x] 1.4 `.env.example`: agregar `MP_WEBHOOK_SECRET=` con placeholder evidentemente falso y comentario (bloque MercadoPago). **Requiere que el usuario lo haga o autorice editar `backend/.env.example`.** Verificar `pytest tests/unit/test_env_example.py` → verde (cobertura de variables).

## 2. Unit of Work reentrante (D6)

- [x] 2.1 RED: nuevo `tests/unit/test_unit_of_work.py` (sobre la `session` de test): una UoW anidada dentro de otra sobre la misma sesión que agrega una fila y sale sin error **no** la confirma por sí sola: si la externa termina con excepción, la fila no existe. Ejecutar → falla (hoy la interna hace `commit`).
- [x] 2.2 GREEN: `UnitOfWork` lleva la profundidad en `session.info`; la anidada abre `begin_nested()` y al salir libera el savepoint sin `commit`; solo la externa hace `commit`/`rollback`. Ejecutar → verde.
- [x] 2.3 TRIANGULATE: (a) externa + anidada sin errores → la fila de ambas existe tras la externa; (b) la anidada lanza y la externa captura la excepción y sigue → lo de la anidada se revirtió (savepoint) y lo de la externa se confirma; (c) la anidada re-lanza siempre su excepción; (d) una UoW sola se comporta como antes (commit al salir, rollback con error); (e) la profundidad vuelve a 0 tras salir, también con error. Ejecutar → verde.
- [x] 2.4 Red de seguridad de la UoW: `pytest tests/integration/test_pedidos_fsm.py tests/integration/test_pedidos_stock.py tests/integration/test_pago_webhook_fsm.py tests/integration/test_historial_append_only.py` → verde (comportamiento externo intacto).

## 3. Firma y configuración del webhook (D1–D4; spec `payment-api` «exige la firma», «sin configuración», «Rutas públicas»)

- [x] 3.1 RED: nuevo `tests/integration/test_pago_webhook_firma.py` con `MP_WEBHOOK_SECRET` y `MP_ACCESS_TOKEN` fijados por `monkeypatch` y el SDK mockeado (pago aprobado): sin `x-signature` → 401 `HTTP_401`, el mock del SDK sin llamar y el pago/pedido sin cambios. Ejecutar → falla (hoy 200).
- [x] 3.2 GREEN: `app/modules/pagos/firma_webhook.py::verificar_firma_webhook` (adaptador del validador → `AppError(401, "HTTP_401", "Firma de webhook inválida")`, log con `reason` y `x-request-id`); `router.webhook` sin `try/except` arma una `NotificacionWebhook` (headers, query, cuerpo JSON/form) y delega; `PaymentService.procesar_webhook` aplica el orden de D4 hasta la firma. Ejecutar → verde.
- [x] 3.3 TRIANGULATE (firma): firma válida con `firmar("123", "abc", ts, secreto)` → no 401 (200); firmada con otra clave → 401; firmada para `123` pero query `data.id=124` → 401 y SDK sin llamar; `x-signature: basura` → 401; el `detail` del 401 es el genérico (no menciona `v1`, `ts` ni el motivo); sin `x-request-id` firmado sin ese par → aceptada. Ejecutar → verde.
- [x] 3.4 TRIANGULATE (configuración e id): sin `MP_WEBHOOK_SECRET` → 503 `HTTP_503` con `MP_WEBHOOK_SECRET` en el `detail`, firmada o no; secreto sí y `MP_ACCESS_TOKEN` no, `type=payment` firmado → 503 nombrando `MP_ACCESS_TOKEN`; mismo caso con `type=merchant_order` → 200 `ignored`; query `data.id=123` y cuerpo `{"data": {"id": "999"}}` firmados → 400 y SDK sin llamar; solo query → el SDK recibe 123. Ejecutar → verde.
- [x] 3.5 TRIANGULATE (ruta pública, MODIFIED de C-04): sin `Authorization`, firma válida y tópico no soportado → 200 `ignored`; sin `Authorization` ni firma → 401. Actualizar `tests/integration/test_pago.py::test_webhook_mercadopago_invalid_payload` para enviar la notificación firmada. Ejecutar → verde.
- [x] 3.6 TRIANGULATE (502): SDK con `payment().get` devolviendo `status` 500 → 502 `HTTP_502` y pago/pedido sin cambios; estado de MP no mapeado → 200 `ignored`. Ejecutar → verde.
- [x] 3.7 Migrar `tests/integration/test_pago_webhook_fsm.py` a notificaciones firmadas (fixture que fija `MP_WEBHOOK_SECRET` y usa `firmar`) sin cambiar sus aserciones de pedido/historial/stock. Ejecutar `pytest tests/integration/test_pago_webhook_fsm.py` → verde.

## 4. Idempotencia por pago de MercadoPago (D5; spec «Idempotencia del webhook»)

- [x] 4.1 RED (unidad): `tests/unit/test_decision_pago_webhook.py` para la función pura `decidir_transicion_pago`: local `aprobado` + cualquier estado → `already_processed`; local `pendiente` + `aprobado` → `procesar`. Ejecutar → falla (no existe).
- [x] 4.2 GREEN: `decidir_transicion_pago` en `app/modules/pagos/` (pura, type hints). Ejecutar → verde.
- [x] 4.3 TRIANGULATE (unidad): local `a_devolver` + `aprobado` → `already_processed`; local `rechazado` id 100 + `rechazado` id 100 → `already_processed`; local `rechazado` id 100 + `aprobado` id 101 → `procesar`; local `aprobado` + `refunded`→`rechazado` → `already_processed`; local `pendiente` id 100 + `pendiente` id 100 → `already_processed`. Ejecutar → verde.
- [x] 4.4 RED (integración): nuevo `tests/integration/test_pago_webhook_idempotencia.py`: dos entregas firmadas del mismo pago aprobado de un pedido `MERCADOPAGO` `PENDIENTE` con stock 5 y 2 unidades → 200 `processed` y 200 `already_processed`; pedido `CONFIRMADO`, una sola fila de historial hacia `CONFIRMADO`, stock 3. Ejecutar → falla si la dedupe no usa `mp_payment_id` (o verde por el código previo: en ese caso escribir primero 4.5, que sí falla hoy).
- [x] 4.5 RED: pago local `rechazado` por el pago 100 y notificación firmada del pago 101 aprobado con la misma referencia → 200 `processed`, pago `aprobado` con id 101, pedido `CONFIRMADO`. Ejecutar → falla (hoy `already_processed`).
- [x] 4.6 GREEN: `PagoRepository.get_by_mp_payment_id_for_update` y `get_ultimo_by_pedido_for_update` (`with_for_update()`, como `ProductoRepository.get_for_update`); `procesar_webhook` resuelve por `mp_payment_id` → `external_reference` → `merchant_order_id` con bloqueo y aplica `decidir_transicion_pago`. Ejecutar → verde.
- [x] 4.7 TRIANGULATE: reentrega de un `rechazado` con el mismo id → `already_processed` sin cambios; pago local `aprobado` y MP informa `refunded` → `already_processed`, pago y pedido sin cambios; referencia externa sin pago local → 200 `ignored` y ninguna fila nueva en `pagos`. Ejecutar → verde.
- [x] 4.8 TRIANGULATE (concurrencia): dos notificaciones del mismo pago aprobado procesadas desde dos sesiones/conexiones independientes contra `foodstore_test` (hilos, cada una con su `Session`; la de test con savepoint no sirve para esto: usar el engine de test y limpiar las filas creadas al final) → exactamente una confirma; stock descontado una vez; una fila de historial. Si el aislamiento de la suite lo impide, documentar la limitación en el test y cubrir el lock con una prueba de `SELECT … FOR UPDATE NOWAIT` que falla mientras otra conexión tiene la fila bloqueada. Ejecutar → verde.

## 5. Consistencia transaccional y fallas de negocio (D6, D7; specs «una sola transacción», «Códigos de respuesta», «no puede confirmar»)

- [x] 5.1 RED: en `test_pago_webhook_idempotencia.py` (o `test_pago_webhook_transaccion.py`), con `app.dependency_overrides[get_payment_service]` que construye `PaymentService(session, construir_pedidos=lambda s: PedidoService(PedidoUnitOfWork(s), al_confirmar=paso_que_falla))`: notificación firmada del pago aprobado de un pedido `MERCADOPAGO` `PENDIENTE` → 500 `INTERNAL_ERROR`; releídos: pago `pendiente`, pedido `PENDIENTE`, sin historial nuevo, stock igual. Ejecutar → falla (hoy 200 y pago inconsistente).
- [x] 5.2 GREEN: `PaymentService.__init__(session, construir_pedidos=construir_pedido_service)`; `procesar_webhook` actualiza pago y confirma el pedido dentro del mismo `PagoUnitOfWork` (la UoW de pedidos queda anidada, sección 2) sin `try/except` genérico; se elimina `uow._session`. Ejecutar → verde.
- [x] 5.3 TRIANGULATE: tras esa falla, quitar el override y reenviar la misma notificación → 200 `processed`, pago `aprobado`, pedido `CONFIRMADO`, stock descontado una vez; la fila nueva de historial tiene `usuario_id` nulo (actor Sistema). Ejecutar → verde.
- [x] 5.4 RED: pago aprobado de un pedido `MERCADOPAGO` en `CANCELADO` → 200, pedido sigue `CANCELADO` sin historial nuevo y pago local `a_devolver`. Ejecutar → falla (hoy queda `pendiente`).
- [x] 5.5 GREEN: capturar solo `AppError` con `code == ErrorCode.INVALID_TRANSITION` alrededor de `confirmar_por_pago_aprobado` → pago `a_devolver` con `mp_payment_id`/`mp_status`; respuesta 200 `processed` sin `pedido_actualizado`. Ejecutar → verde.
- [x] 5.6 TRIANGULATE: pedido `EFECTIVO` `PENDIENTE` → 200, pedido `PENDIENTE` sin historial, pago `a_devolver`; el dueño consulta `GET /api/v1/pagos/{pedido_id}` → `estado` `a_devolver`; sin stock (C-10) → 200, `CANCELADO` «Sin stock», pago `a_devolver`; reentrega del pago `a_devolver` → `already_processed`; el router no encola WebSocket cuando no hay `pedido_actualizado` (verificar con un doble de `manager.send_to_room` o inspeccionando `BackgroundTasks`). Ejecutar → verde.
- [x] 5.7 REFACTOR: `router.webhook` sin `try/except`, sin `Session` ni reglas; `PaymentService` sin `except Exception` en el webhook. Verificar `grep -n "except Exception" backend/app/modules/pagos/` sin resultados en el camino del webhook y `pytest tests/integration/test_pago*.py tests/unit/test_decision_pago_webhook.py tests/unit/test_unit_of_work.py` → verde.

## 6. Documentación (D10)

- [x] 6.1 KB: `07` Flujo 5 (firma, orden, códigos 200/401/400/502/503/500, una transacción, idempotencia por `mp_payment_id`); `09` (DT-06, DT-20, DT-21 resueltas por C-05; DT-13 cerrada); `11` (tabla objetivo/actual de webhook e idempotencia, estados locales con `a_devolver` también para pedidos no confirmables, §Riesgos conocidos sin firma/200-siempre/IN-22, §Sandbox: configurar solo «Webhooks» y la clave secreta); `05` (RN-PA-02: `idempotency_key` es la clave de creación; RN-PA-03: ya no «responde 200 rápido» ante errores); `08` (variable `MP_WEBHOOK_SECRET`). Verificar con `grep -n "DT-06\|DT-20\|DT-21\|MP_WEBHOOK_SECRET" knowledge-base/*.md`.

## 7. Cierre

- [x] 7.1 Revisión de capas, SOLID y DRY: la firma vive solo en `firma_webhook.py`; la decisión de idempotencia solo en `decidir_transicion_pago`; el router no tiene lógica; type hints en las firmas públicas nuevas; ningún secreto en código ni tests (los tests usan un valor de prueba literal, no del `.env`).
- [x] 7.2 Suite completa: 0 failed y passed ≥ baseline de 0.2 más los tests nuevos; registrar el número y la diferencia. Resultado: 1343 passed, 0 failed (baseline 1286, +57).

## Workflow follow-up

- `openspec-verify` → `/opsx:archive c-05-pagos-webhook-firma-idempotencia` (después del archivo de C-04; marca `[x]` en CHANGES.md y agrega «Punto de partida (C-05)» en C-12 y C-20: webhook firmado con `MP_WEBHOOK_SECRET`, idempotencia por `mp_payment_id`, UoW reentrante, `a_devolver` para pagos no confirmables).
- Configurar `MP_WEBHOOK_SECRET` en el `.env` local/despliegue antes de probar con MercadoPago real.
