# Tasks — `endurecimiento-pagos-webhook`

> **Governance CRÍTICO — apply bloqueado**: no se escribe código (ni tests) hasta cerrar el bloque 0. Sin commits ni push salvo pedido del usuario (reglas 14 y 15).
> **Strict TDD** (skills `tdd`, `python-testing-patterns`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde tras cada paso; tests por la interfaz pública (HTTP) o por las funciones puras de decisión; literales del spec, sin aserciones tautológicas. pytest contra PostgreSQL `foodstore_test` desde `backend/`.
> **Hard rules**: capas `models ← repository ← uow ← services ← routers` (router sin lógica ni `Session`); decisiones puras sin I/O; sin migraciones; sin secretos en código, tests ni logs (valores de test literales, nunca los del `.env`); sin build ni dev server por iniciativa propia.

## 0. Gate previo (antes de apply)

- [x] 0.1 OK del usuario (gobernanza CRÍTICO) antes de escribir código: presentar proposal, specs y design, y registrar en `design.md` §Open Questions la decisión de OQ-1, OQ-2 y OQ-3 (o «por defecto»). Si alguna difiere de la recomendada, ajustar specs/design/tasks con `/opsx:update` antes de seguir. Verificación: OK y decisiones anotadas con fecha en `design.md`.

## 1. Red de seguridad

- [x] 1.1 Correr `pytest tests/integration/test_pago*.py tests/integration/test_flujo_compra_pago_entrega.py tests/integration/test_seed.py tests/unit/test_decision_pago_webhook.py tests/unit/test_decision_cobro.py tests/unit/test_pasarela_mp.py` y después la suite completa; anotar la línea base (N passed) en `design.md`. Si algo falla, frenar y reportarlo como falla previa (no corregirla).

## 2. Seed con salida ASCII (spec `backend-db-seed`, D7; governance BAJO)

- [x] 2.1 RED: en `tests/integration/test_seed.py`, test que reemplaza `sys.stdout` por `io.TextIOWrapper(io.BytesIO(), encoding="cp1252", errors="strict")` y corre `seed(migrations_db)` sobre base nueva → espera que termine y deje roles, estados, formas de pago y usuarios. Ejecutar → falla con `UnicodeEncodeError` (`seed.py:128/132`).
- [x] 2.2 GREEN: reemplazar los emojis de `app/db/seed.py` por marcadores ASCII. Ejecutar → verde.
- [x] 2.3 TRIANGULATE: segunda corrida con stdout cp1252 (camino «usuario ya existe») termina sin errores y no cambia filas; además, test de que toda la salida capturada de una corrida se codifica en cp1252. Ejecutar → verde. REFACTOR si hace falta.

## 3. Dobles de test (sin cambio de comportamiento)

- [x] 3.1 `tests/support/mp_webhook.py`: `construir_orden` suma `total_amount`; `order().create` devuelve el `total_amount` enviado si la respuesta configurada no trae uno; `responder_consulta` acepta `total_amount` (default `"1500.00"`); helper `monto_de(session, pedido_id)` en `pagos_factory.py`. `post_webhook` firma por defecto `order_id.lower()` (los tests que necesiten la variante tal cual la piden con `firmar_id`). Verificación: la suite de la tarea 1.1 sigue igual que la línea base.

## 4. Mapeo de estados de la orden (spec `payment-api` «Estados de la orden…», D1)

- [x] 4.1 RED: `tests/unit/test_decision_pago_webhook.py`, parametrizado sobre la tabla del spec (`processed`, `partially_refunded` → `aprobado`; `failed`, `canceled`, `refunded`, `charged_back` → `rechazado`; `created`, `processing`, `action_required` → `pendiente`; `expired_x`/`None` → sin mapeo) contra una función pública de `decision_webhook.py` que todavía no existe. Ejecutar → falla.
- [x] 4.2 GREEN: mover la tabla a `decision_webhook.py` (`ESTADO_LOCAL_POR_ESTADO_ORDEN` + función) y que `PaymentService` la use. Ejecutar → verde.
- [x] 4.3 TRIANGULATE por endpoint: escenarios «Orden cancelada informada por el webhook», «Contracargo sobre un pago no aprobado», «Orden recién creada» (creación) y «Orden creada informada por el webhook», «Orden reembolsada en parte antes de la primera notificación», «Reembolso parcial de un pago ya aprobado». Ejecutar → verde. REFACTOR: borrar `_estado_local_para` si quedó vacío.

## 5. Respuesta mínima del webhook (spec «Códigos de respuesta del webhook», D2)

- [x] 5.1 RED: `tests/integration/test_pago_webhook_respuesta.py`: cuerpo exactamente `{"status": "processed"}` al confirmar, `{"status": "already_processed"}` en la reentrega, `{"status": "ignored"}` sin pago local, con tópico `payment` y con estado no mapeado. Ejecutar → falla (hoy trae `pago_id`, `pedido_actualizado`, `reason`).
- [x] 5.2 GREEN: `ResultadoWebhook`/`ResultadoAplicacion` tipados en el service (sin `dict`), `WebhookRespuesta` en `schemas.py` con `response_model` en el router; el router sigue disparando el WebSocket con `pedido_actualizado`. Ejecutar → verde.
- [x] 5.3 TRIANGULATE: «El aviso en tiempo real no depende del cuerpo» (`test_el_router_solo_dispara_websocket_cuando_hay_pedido_actualizado` sigue verde y se agrega la aserción del cuerpo); a_devolver por pedido cancelado responde `{"status": "processed"}`; la creación (`POST /pagos/crear`) no cambia su 201. Ejecutar → verde. REFACTOR: `_aplicar_resultado_de_creacion` usa el resultado tipado.

## 6. Webhook fuera del event loop (spec «El webhook no bloquea el event loop», D3)

- [x] 6.1 RED: el doble de `order().get` registra si su hilo tiene un event loop corriendo; test por endpoint que exige que la consulta corra sin loop. Ejecutar → falla (hoy corre en el loop).
- [x] 6.2 GREEN: `procesar_webhook` y el handler a `def`; la lectura del cuerpo pasa a una dependencia `async` (`Annotated[NotificacionWebhook, Depends(...)]`). Ejecutar → verde, incluidos los tests de JSON, form-data y cuerpo ilegible existentes.
- [x] 6.3 TRIANGULATE: test de concurrencia «Otra petición durante una consulta lenta» (la consulta espera un `threading.Event`; `GET /health` responde antes; timeout corto, sin `sleep`). Si resulta inestable, documentarlo en `design.md` y dejar solo 6.1. Ejecutar → verde.

## 7. Control del monto (spec «Control del monto antes de confirmar», D4)

- [x] 7.1 RED unitario: `monto_coincide` en `decision_webhook.py` — igual (`1500.00` vs `"1500.00"`), igual con distinta escala (`1500` vs `"1500.0"`), distinto por un centavo, `None`. Ejecutar → falla.
- [x] 7.2 GREEN unitario; RED de integración: `test_pasarela_mp.py` lee `total_amount` de la orden (texto → `Decimal`; ausente o inválido → `None`) y escenario «Monto distinto en el webhook». Ejecutar → falla.
- [x] 7.3 GREEN: `ResultadoMP.total_amount`; en `_aplicar_resultado_mp`, si el estado es `aprobado` y el monto no coincide → datos de MercadoPago registrados, pago `a_devolver`, `warning` con `pago_id` y ambos montos, `processed` sin pedido. Ejecutar → verde.
- [x] 7.4 TRIANGULATE: «Monto igual», «Orden sin monto», «Monto distinto en la creación» (201 `a_devolver`), «Rechazo con monto distinto», «Reintento tras un monto distinto» (409) y reentrega del mismo `processed` → `already_processed`. Ejecutar → verde. REFACTOR.

## 8. Logs sin secretos por endpoint (spec «Los logs de pagos no contienen secretos», D5)

- [x] 8.1 RED/GREEN: `tests/integration/test_pago_logs_sin_secretos.py` con `caplog` en DEBUG: errores al crear (red, 401, 500), firma con otra clave, consulta 401 y 500, monto distinto y camino feliz; afirma que hubo registros y que `caplog.text` no contiene el access token de test, `SECRETO`, el token de tarjeta ni el `v1` enviado. Si falla, corregir el punto de log que filtra. Ejecutar → verde.

## 9. Sandbox manual — REQUIERE AL USUARIO (ngrok + credenciales `APP_USR-` de prueba)

> Lo ejecuta el usuario (o el agente acompañándolo, sin manipular credenciales): el agente no corre llamadas al sandbox por su cuenta. Preparación: `openspec/changes/archive/2026-11-17-c-12-pagos-checkout-api-cardpayment/sandbox/README.md`, con el backend ya con los bloques 4–8. Registrar cada resultado en `design.md` §«Verificación manual en sandbox», incluida **la variante de `data.id` con la que firmó cada notificación** (minúsculas o tal cual).

- [x] 9.1 [USUARIO] Caso `OTHE` (error general): esperado 201 `rechazado`, `mp_status` `failed`, pedido `PENDIENTE`; webhook `order` firmado → 200 `{"status": "already_processed"}`. Verificación: resultado y variante de firma anotados.
- [x] 9.2 [USUARIO] (NO OBSERVADO 2026-11-21: MercadoPago no notificó la orden `CONT`; cubierto por tests de integración, ver design.md §Verificación manual en sandbox) Caso `CONT` (pendiente) con ngrok activo: esperado 201 `pendiente` (`processing`) y luego el webhook lo resuelve (pago `aprobado` o `rechazado`, pedido acorde, cuerpo `{"status": "processed"}`). Verificación: transición observada y variante de firma anotadas.
- [x] 9.3 [USUARIO] OQ-14, clave de idempotencia repetida (cortar la red a mitad de un pago y reintentar): anotar si MercadoPago devuelve la orden original o 409 `idempotency_key_already_used` + búsqueda por `external_reference`, y el resultado final del pago. Si no se puede reproducir, anotarlo como no ejecutado con el motivo.
- [x] 9.4 [USUARIO] Caso `APRO` sobre la implementación nueva: confirma que el `total_amount` real de la orden coincide con `transaction_amount` (pedido `CONFIRMADO`, no `a_devolver`). Verificación: resultado anotado.

## 10. Firma solo en minúsculas (spec «Id en minúsculas en el manifest de la firma», D6) — después del bloque 9

- [x] 10.1 Revisar la evidencia de 9.x: si todas las notificaciones firmaron en minúsculas (y hay al menos dos nuevas), seguir con OQ-2 = A; si alguna firmó tal cual, aplicar OQ-2 = B con `/opsx:update` (se quita del delta el REMOVED de «Variantes del id…» y el ADDED «Id en minúsculas…», y la spec sigue aceptando ambas) y saltear 10.2–10.3. Verificación: decisión anotada en `design.md`.
- [x] 10.2 RED: `test_pago_webhook_firma.py:216` pasa a «firma con el id tal cual → 401 sin consultar ni cambiar nada»; agregar «id que ya viene en minúsculas se acepta». Ejecutar → falla el primero.
- [x] 10.3 GREEN: `verificar_firma_webhook` valida una sola vez con `data_id.lower()`; docstring actualizado. Ejecutar → verde, incluidos los demás tests de firma. REFACTOR.

## 11. Cierre y verificación

- [x] 11.1 Suite completa del backend verde (comparar con la línea base de 1.1); `openspec validate endurecimiento-pagos-webhook --strict` válido. Verificación: números anotados en `design.md`.
- [x] 11.2 Docs: KB/11 (respuesta del webhook, control del monto, firma, `partially_refunded`), KB/05 RN-PA-03 (respuesta `{status}` y monto), y nota de seguimiento en `CHANGES.md` (ajuste y bullet «Heredado de C-12» de C-25a). Verificación: diffs de documentación revisados por el usuario.
- [x] 11.3 Revisión SOLID/DRY y de capas del módulo `pagos` (sin `dict` sueltos entre service y router, decisiones puras sin I/O, router sin lógica). Verificación: anotada en `design.md`.

## Workflow follow-up

- Verify independiente (`openspec-verify`) con foco en seguridad (gobernanza CRÍTICO).
- `/opsx:archive endurecimiento-pagos-webhook`: sincroniza `payment-api` y `backend-db-seed` y marca `[x]` en `CHANGES.md`.
- Commits según el flujo `dev → main → dev` de `CLAUDE.md`, solo a pedido del usuario.
