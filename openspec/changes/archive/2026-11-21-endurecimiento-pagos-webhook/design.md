# Design — `endurecimiento-pagos-webhook`

> **Governance CRÍTICO** (pagos). Nada de este diseño se implementa sin el OK del usuario (tarea 0.1) y su respuesta a OQ-1..OQ-3. Los specs asumen la opción recomendada de cada OQ, marcada en el texto del requisito.

## Context

Motivación en `proposal.md` (§Why). El módulo `backend/app/modules/pagos/` quedó así tras C-12 (Orders API, DD-26) y C-25a (capas): `router.py` (HTTP, WebSocket por `BackgroundTasks`), `service.py` (`PaymentService`: crear pago en T1 → llamada a MercadoPago sin locks → T2; webhook firma → tópico/id → consulta → transacción única), `pasarela_mp.py` (único módulo que conoce el SDK), `decision_cobro.py` y `decision_webhook.py` (decisiones puras), `firma_webhook.py` (adaptador del validador del SDK). Tests de integración contra PostgreSQL real con el SDK reemplazado por `MPFalso` (`tests/support/mp_webhook.py`) y la firma calculada con HMAC real (`tests/support/mp_firma.py`).

### Hallazgos por ítem (código en `dev`, 2026-11-20)

| # | Hoy (archivo:línea) | Plan |
|---|---|---|
| 1 | `_estado_local_para` (`service.py:188-196`) mapea los 10 estados, pero los tests solo ejercitan `processed`, `failed`, `processing`, `refunded` (sobre un `aprobado`, `test_pago_webhook_idempotencia.py:70`) y `action_required`. `canceled`, `charged_back`, `created` y `partially_refunded` no tienen test; `canceled` tiene escenario en la spec («Orden cancelada por vencimiento») pero ningún test lo cubre. | D1: test unitario parametrizado de la tabla completa (incluido «no mapeado → `None`») + escenarios de integración nuevos de la spec. |
| 2 | `partially_refunded → aprobado` en `service.py:190` y en D20 de C-12 (`archive/2026-11-17-c-12-…/design.md:179`); la spec principal (`payment-api` «Estados de la orden…») no lo nombra. | OQ-1 (recomendado: especificarlo). D1. |
| 3 | `router.py:88-92` devuelve el `dict` del service: `{"status","pago_id","pedido_actualizado": PedidoDetalle}` (`service.py:281`), `{"status","pago_id"}` (`:265`, `:277`) o `{"status":"ignored","reason":"Pago not found"}` (`:239`). Sin `response_model`. Nadie más lo lee: el frontend no consume el webhook (solo un comentario en `frontend/src/entities/payment/model/payment-store.ts:14`); un test ya exige que falte `pedido_actualizado` en un caso (`test_pago_webhook_transaccion.py:86`). | D2. |
| 4 | `async def webhook` (`router.py:79`) hace `await svc.procesar_webhook(...)`, y `async def procesar_webhook` (`service.py:211`) llama sincrónicamente a `PasarelaMercadoPago.consultar_orden` (SDK sobre `requests`, `pasarela_mp.py:136-138`) y abre `PagoUnitOfWork` (PostgreSQL). Todo corre **en el event loop**: una consulta lenta a MercadoPago congela el servidor. El resto de los handlers de pagos ya son `def`. | D3. |
| 5 | `ResultadoMP` (`pasarela_mp.py:56-63`) y `_a_resultado` (`:70-79`) no leen `total_amount`; `_aplicar_resultado_mp` (`service.py:242-266`) confirma con solo el estado. `pagos.transaction_amount` (`models.py:39`) ya guarda lo que se mandó como `total_amount` al crear (`service.py:113`, `pasarela_mp.py:114,121`). | D4, OQ-3. |
| 6 | Se prueba solo en el adaptador (`tests/unit/test_pasarela_mp.py:231-250`). Logs que pueden tocar datos sensibles: `firma_webhook.py:28` (motivo + `x-request-id`), `pasarela_mp.py:159` (tipo de excepción), `:169` (status + code), `:171`, `:198`. `app/core/logger.py:74` pone `propagate=False` en el logger `app`, pero `caplog` ya captura `app.*` en integración (`test_auth_refresh.py:215-231`), así que el patrón sirve. | D5. |
| 7 | `firma_webhook.py:20` prueba `[data_id.lower(), data_id]`. El sandbox de C-12 observó **una** notificación firmada con el id en minúsculas y no tal cual (`archive/…c-12…/design.md:125`); las otras dos «fueron aceptadas» sin registrar la variante. El default acordado de OQ-13 era «se deja solo la que firme MercadoPago» (`:274`). **Ojo:** `post_webhook` firma por defecto `order_id` tal cual (`tests/support/mp_webhook.py:168,174`, `firmar_id="__order_id__"`), o sea que **casi toda la suite del webhook usa hoy la variante a retirar**. | OQ-2 (recomendado: retirarla tras confirmarlo en sandbox). D6. |
| 8 | `OTHE` y OQ-14 nunca se corrieron. `CONT` sí se usó en el verify visual de C-20b (pedido #5 quedó `pendiente`, `archive/2026-11-19-c-20b-…/design.md:73`), pero **sin ngrok**: la transición pendiente → aprobado/rechazado por webhook no se observó. | Bloque manual 8 de `tasks.md` (requiere al usuario). |
| 9 | `seed.py:128` y `:132` imprimen `✅` dentro de `with Session(engine) as session, session.begin()` (`:285-288`): en cp1252, `UnicodeEncodeError` → rollback de toda la siembra. `:290-298` imprimen `✅👤📦📊🍔` **después** del commit: los datos quedan pero el proceso termina con traceback. | D7. |

Además, en C-25b no hay otros pendientes de pagos heredados: solo la prueba E2E del flujo compra→pago→entrega con frontend, que se beneficia de este change pero no se toca acá. PA-05 está resuelta (DD-21); PA-08 (reembolsos) sigue abierta y fuera de alcance.

## Goals / Non-Goals

**Goals:**
- Cerrar los 9 ítems «Heredado de C-12» con tests que fallen antes del cambio.
- No cambiar el contrato de `POST /pagos/crear` ni de `GET /pagos/{id}` salvo el nuevo `a_devolver` por monto distinto.
- Mantener las capas (`router` sin lógica; decisiones puras testeables sin BD) y el único camino `_aplicar_resultado_mp` para creación y webhook.

**Non-Goals:**
- Sin migración ni estado de pago nuevo.
- Sin ventana de `ts` en la firma; sin reembolsos; sin cambios de frontend.
- No se automatizan los casos de sandbox (necesitan tarjetas de prueba, ngrok y credenciales del usuario).

## Decisions

**D1 — Mapeo de estados: tabla única y test de la tabla.** `_estado_local_para` pasa a una constante `ESTADO_LOCAL_POR_ESTADO_ORDEN: Mapping[str, str]` en `decision_webhook.py` (lógica pura, junto a `decidir_transicion_pago`) y la función se reduce a `.get()`. Test unitario parametrizado sobre los 10 estados + uno desconocido, más los escenarios de integración de la spec (`canceled` y `charged_back` por webhook, `created` en la creación y en el webhook, `partially_refunded` como primera notificación y sobre un `aprobado`). *Alternativa:* dejar el `if` encadenado y testear por endpoint solamente; descartada porque la tabla es el contrato y un test unitario la fija barata.

**D2 — Respuesta del webhook tipada y mínima.** El service devuelve un `ResultadoWebhook` (dataclass: `status: EstadoWebhook` — `processed | already_processed | ignored` — y `pedido_actualizado: PedidoDetalle | None`), y `_aplicar_resultado_mp` devuelve un `ResultadoAplicacion` (mismo par, más el `Pago` para armar la respuesta de la creación) en lugar de `dict`; la creación usa el mismo resultado (`service.py:171` deja de hacer `aplicado.get(...)`). El router declara `response_model=WebhookRespuesta` (schema Pydantic con `status: Literal[...]`, `extra="forbid"`), dispara el WebSocket con `pedido_actualizado` y devuelve solo el `status`. Se elimina `reason`. *Alternativa:* filtrar el `dict` en el router; descartada: deja el contrato implícito y el router decidiendo qué es interno.

**D3 — Webhook sin bloquear el event loop.** `procesar_webhook` pasa a `def`. El handler pasa a `def` y recibe la notificación por una dependencia `async def leer_notificacion(request) -> NotificacionWebhook` (la actual `_leer_notificacion`, que necesita `await request.json()/form()`), declarada con `Annotated[NotificacionWebhook, Depends(...)]`. FastAPI resuelve la dependencia async en el loop y corre el handler sync en el threadpool, como el resto de los endpoints de pagos. Test: el doble de `order().get` registra si hay un event loop corriendo en su hilo (`asyncio.get_running_loop()` → `RuntimeError` fuera del loop) y un test de concurrencia hace que la consulta espere un `threading.Event` mientras `GET /health` responde. *Alternativa:* dejar `async` y envolver con `run_in_threadpool`; descartada: dos estilos para lo mismo y el service seguiría siendo «async» de nombre.

**D4 — Control del monto antes de confirmar.** `ResultadoMP` suma `total_amount: Decimal | None`, parseado en `_a_resultado` desde el texto de la orden (inválido o ausente → `None`). Función pura `monto_coincide(esperado: Decimal, informado: Decimal | None) -> bool` en `decision_webhook.py` (ambos cuantizados a 0.01; `None` → `False`). En `_aplicar_resultado_mp`, **solo si `nuevo_estado == "aprobado"`** y el monto no coincide: se registran `mp_order_id`, `mp_payment_id`, `mp_status`, `mp_status_detail`, el pago queda `a_devolver`, se loguea `warning` con `pago_id`, monto esperado e informado, y se devuelve `processed` sin pedido actualizado. Como `a_devolver` es terminal (`decision_webhook.py:6`) y bloquea nuevos cobros (`decision_cobro.py:8`), las reentregas responden `already_processed` y el reintento del cliente 409, sin código nuevo. Se compara contra `pago.transaction_amount` (lo que se pidió cobrar en ese intento), no contra `pedido.total`. Aplica igual en la creación sincrónica (el mismo método). *Alternativas* en OQ-3.

**D5 — Logs sin secretos, probado por los endpoints.** Test de integración nuevo `test_pago_logs_sin_secretos.py` con `caplog.set_level(logging.DEBUG)`: recorre por HTTP los caminos de error de `POST /pagos/crear` (red, 401, 500) y del webhook (firma con otra clave, consulta 401 y 500, monto distinto) y el camino feliz, y afirma que `caplog.text` no contiene el access token de test, `SECRETO`, el token de tarjeta enviado ni el `v1` del header; además que hubo al menos un registro (no tautológico). Los valores sensibles son literales de test (`tests/support/settings_env.py` / `mp_webhook.SECRETO`), nunca los del `.env`. Si el test encuentra una fuga, se corrige en el punto de log (hoy no se espera ninguna).

**D6 — Firma solo con el id en minúsculas (si OQ-2 = A).** `verificar_firma_webhook` valida una sola vez con `data_id.lower()` (o `None`); se borra el bucle de variantes y se actualiza el docstring (D23 de C-12 queda superado). En tests: `post_webhook` firma por defecto `order_id.lower()` (así toda la suite deja de depender de la variante retirada), el test «tal cual se acepta» (`test_pago_webhook_firma.py:216`) pasa a «tal cual responde 401 sin consultar» y se agrega «id que ya viene en minúsculas». **Orden:** esta tarea va después del bloque manual 8 (que registra la variante de cada notificación); si el sandbox muestra alguna firmada tal cual, se aplica OQ-2 = B y se quitan del delta el REMOVED «Variantes del id en el manifest de la firma» y el ADDED «Id en minúsculas en el manifest de la firma».

**D7 — Seed con salida ASCII.** Se reemplazan los emojis de `seed.py` por marcadores ASCII (`[OK]`, `-`), como ya hace `app/db/reset.py:12`. Test: `monkeypatch.setattr(sys, "stdout", io.TextIOWrapper(io.BytesIO(), encoding="cp1252", errors="strict"))` y correr `seed(migrations_db)` dos veces sobre base nueva. *Alternativa:* `sys.stdout.reconfigure(encoding="utf-8")` en `__main__`; descartada: no cubre a quien llame `seed()` ni la salida redirigida a un archivo cp1252, y el test no la ejercitaría.

## Open Questions

### Decisiones del usuario (2026-11-20, por el usuario)

OK de gobernanza CRÍTICO dado el 2026-11-20 (tarea 0.1). Las tres preguntas se resolvieron con la opción recomendada:

- **OQ-1 = A**: `partially_refunded` → `aprobado`, especificado y testeado.
- **OQ-2 = A**: se retira la variante «tal cual» de la firma, condicionado a la evidencia del bloque manual 9 (tarea 10.1).
- **OQ-3 = A**: monto distinto → pago `a_devolver`, pedido sin cambios, 200 `processed`, `warning` en el log.

Specs y tasks ya asumían estas opciones; no hace falta `/opsx:update`.

Requieren respuesta del usuario en la tarea 0.1 (cambian el spec o las tareas; por eso el spec ya asume la recomendada y la marca).

- **OQ-1 — `partially_refunded` (ítem 2).** Solo importa cuando la **primera** notificación que el backend ve de una orden ya está reembolsada en parte (si antes vio `processed`, el pago es `aprobado` y terminal).
  - **A (recomendada): especificarlo como `aprobado`** y testearlo. El cobro existió y la parte devuelta la decidió el comercio desde el panel; dejar el pedido sin confirmar dejaría dinero cobrado sin pedido. El control de monto (D4) igual aplica (`total_amount` de la orden no cambia con un reembolso).
  - B: quitarlo del mapeo → el webhook responde `ignored` y el pago queda `pendiente` sin resolución (habría que revisar a mano).
  - C: mapearlo a `a_devolver` → pedido sin confirmar y pago marcado para revisión; más conservador, pero inventa una semántica de «devolución» que PA-08 no decidió.
- **OQ-2 — Variante «tal cual» de la firma (ítem 7).**
  - **A (recomendada): retirarla**, condicionado a que el bloque manual 8 registre al menos dos notificaciones más firmadas en minúsculas y ninguna tal cual. Coincide con la doc de MercadoPago y con el default acordado en OQ-13 de C-12; una sola regla es más fácil de razonar y auditar.
  - B: mantener ambas y especificarlo así (es lo que dice hoy la spec). No debilita la seguridad (ambas son HMAC con la clave secreta) y protege si MercadoPago o su SDK cambian de criterio; costo: una rama más.
- **OQ-3 — Qué hacer si el monto no coincide (ítem 5).**
  - **A (recomendada): pago `a_devolver`, pedido sin cambios, 200 `processed`, aviso en el log.** Reutiliza el estado y la consulta que ya existen para «cobrado sin pedido que lo respalde»; MercadoPago no reintenta algo que no se arregla reintentando.
  - B: dejar el pago `pendiente` y responder 200 `ignored`: el pedido queda trabado y nadie se entera salvo por el log.
  - C: responder 500 para que MercadoPago reintente: inútil (el monto no va a cambiar) y llena el log de reintentos.

## Risks / Trade-offs

- **[Churn de tests por el monto]** → El doble `MPFalso` hoy no devuelve `total_amount`; con D4 todo `processed` sin monto quedaría `a_devolver`. Mitigación: `construir_orden` suma `total_amount`; `order().create` devuelve el `total_amount` enviado cuando la respuesta configurada no trae uno (como MercadoPago); `responder_consulta` toma `total_amount` con default `"1500.00"` (el monto de `pedido_con_pago`/`pedido_sin_pagos`), y los tests que usan `pedido_a_pagar` (total `100 * cantidad`) lo pasan explícito con un helper `monto_de(session, pedido_id)`. La red de seguridad (tarea 1.1) detecta cualquier test que cambie de resultado por el doble y no por el código.
- **[Churn de tests por la firma]** → `post_webhook` firma tal cual por defecto; cambiar el default a minúsculas antes de retirar la variante (tarea 6.1) deja la suite verde en ambos estados.
- **[Monto distinto por redondeo]** → `total_amount` se manda cuantizado a 0.01 (`_monto_texto`) y se compara cuantizado: un falso positivo solo ocurriría si MercadoPago devolviera otro monto, que es justo lo que se quiere detectar.
- **[Retirar la variante y que MercadoPago firme tal cual]** → todo webhook daría 401 y MercadoPago reintenta; los cobros aprobados en la creación igual confirman el pedido, pero los `processing` quedarían sin resolver. Mitigación: D6 se aplica después de confirmarlo en sandbox (OQ-2) y el 401 queda en el log con `x-request-id`.
- **[Test de concurrencia del event loop frágil]** → depende de hilos y de `TestClient`. Mitigación: usa `threading.Event` con timeout corto y sin `sleep`; si resulta inestable, queda solo el test determinístico de «sin event loop en el hilo de la consulta» y se anota en el verify.
- **[Respuesta del webhook más pobre para depurar]** → se pierde `pago_id` en el panel de ngrok. Mitigación: el log del backend (sin secretos) y `GET /pagos/{pedido_id}` siguen dando el detalle.

## Migration Plan

Sin migración de esquema ni de datos. Despliegue: solo backend. Rollback: revertir el commit del change (la respuesta del webhook no tiene consumidores y los pagos `a_devolver` por monto distinto, si los hubiera, se revisan a mano como los de «sin stock»).

## UI Mockups

- Decision: no (no UI) (2026-11-20). El change es solo backend; el frontend no consume la respuesta del webhook y el estado `a_devolver` ya lo muestra la UI de C-20b/C-21.

## Registro de apply (bloques 0-8, 2026-11-20)

**Línea base (tarea 1.1).** Antes de tocar código, el conjunto dirigido (`test_pago*.py`, `test_flujo_compra_pago_entrega.py`, `test_seed.py`, `test_decision_pago_webhook.py`, `test_decision_cobro.py`, `test_pasarela_mp.py`): **206 passed**. Suite completa previa informada por el orquestador: **1862 passed** (el intento de repetirla antes de empezar se cortó por lentitud de la máquina; la suite completa final está en el cierre, tarea 11.1).

**Desvíos respecto del diseño.**
- D2: un único `ResultadoWebhook` (`status: EstadoWebhook` + `pedido_actualizado`) sirve a la creación y al webhook; no hace falta un `ResultadoAplicacion` aparte porque `_aplicar_resultado_de_creacion` ya tiene el `Pago` a mano.
- D6 (adelantado, no previsto): `verificar_firma_webhook` registra en `INFO` con qué variante del `data.id` validó (`id=minusculas|tal_cual`, con el `x-request-id`; sin secretos). Es la evidencia que el bloque 9 necesita para decidir OQ-2 (el panel de ngrok no muestra el manifest). Se borra junto con la variante en 10.3. Test: `tests/unit/test_firma_webhook.py`.
- D4: `ResultadoMP.total_amount` tiene default `None` (el campo es el último) para no romper construcciones posicionales.
- Doble `MPFalso`: `responder_orden` devuelve en la creación el `total_amount` enviado (como MercadoPago) y `responder_consulta`/`solo_consulta` traen `"1500.00"`; `total_amount=None` simula orden sin monto. Tests con montos propios (`test_pago_webhook_fsm.py` con su SDK propio, `test_pago_webhook_concurrente.py` con 200.00, la carrera crear↔webhook y la reconciliación en `test_pago_checkout_api.py`) pasan el monto explícito.
- 6.3: el test de concurrencia (`test_health_responde_mientras_la_consulta_de_la_orden_esta_en_curso`) resultó estable (3/3 corridas, falla sobre el código anterior); se conserva junto con el determinístico.
- 8.1: `test_pago_logs_sin_secretos.py` pasó a la primera (no había fuga): se mantiene como guarda.

**Suite completa tras los bloques 0-8: 1921 passed** (línea base 1862 + 59 tests nuevos).

**Estado.** Bloques 0-8 hechos; faltan el bloque 9 (sandbox, usuario), el 10 y el 11.

## Verificación manual en sandbox (bloque 9, 2026-11-21)

Entorno: backend local con los bloques 0-8, ngrok `https://dwelling-recycled-niece.ngrok-free.dev` → `/api/v1/pagos/webhook` (evento «Order»), credenciales `APP_USR-` de prueba cargadas por el usuario, `LOG_LEVEL=INFO`. Pedidos `MERCADOPAGO` de $1.550 creados con el cliente demo del seed; pagos hechos por el usuario desde `pago-prueba.html` de C-12. Evidencia: tabla `pagos`, log del backend (línea `Firma de webhook MP válida: id=…`) y panel de ngrok (cuerpo de la respuesta).

| Tarea | Pedido | Titular | Resultado del pago | Pedido | Webhook (hora local) | Variante de firma | Cuerpo |
|-------|--------|---------|--------------------|--------|----------------------|-------------------|--------|
| 9.1 | 57 | `OTHE` | `rechazado`, `failed` / `rejected_by_issuer` | `PENDIENTE` | 15:01:02 | `minusculas` | `{"status":"already_processed"}` |
| 9.2 | 58 | `CONT` | `pendiente`, `processing` / `in_process` | `PENDIENTE` | — (MercadoPago no notificó) | — | — |
| 9.4 | 59 | `APRO` | `aprobado`, `processed` / `accredited` | `CONFIRMADO` | 15:02:56 | `minusculas` | `{"status":"already_processed"}` |
| 9.3 | 60 | `APRO` (red cortada) | `aprobado`, `processed` / `accredited` | `CONFIRMADO` | 15:05:44 | `minusculas` | `{"status":"already_processed"}` |

- **9.1 `OTHE`**: coincide con lo esperado. El webhook llega después de la respuesta sincrónica y no cambia nada.
- **9.4 `APRO`**: el `total_amount` real de la orden coincidió con `transaction_amount` (1550.00): sin `warning` de monto, pago `aprobado` (no `a_devolver`), pedido `CONFIRMADO` por el sistema.
- **9.3 OQ-14**: el primer intento terminó en `ConnectionError` al crear la orden (15:04:37) con el pago local `pendiente`; el reintento (15:05:42) reusó el mismo registro y la misma `idempotency_key` y MercadoPago **devolvió la orden original** (201, una sola orden `ORDTST01M7ZMJ2Y67…`), sin 409 `idempotency_key_already_used` (no hay log `MercadoPago respondió 409`). Un solo pago aprobado.
- **9.2 `CONT`**: MercadoPago dejó la orden en `processing`/`in_process` y no envió ninguna notificación `order` para ella durante la sesión, así que no se pudo observar al webhook resolviendo el pendiente. La resolución por webhook de un pendiente queda cubierta por los tests de integración (`test_pago_webhook_estados_orden.py`, `test_pago_webhook_fsm.py`).
- **Firma**: 3 notificaciones nuevas, las 3 firmadas con el `data.id` en **minúsculas**, ninguna «tal cual» (más la de C-12, también en minúsculas). Se cumple la condición de 10.1 para OQ-2 = A.
- **Respuesta del webhook**: el cuerpo es exactamente `{"status": …}` en las tres.

**Decisión 10.1 (2026-11-21): OQ-2 = A.** Las 3 notificaciones del sandbox (más la de C-12) firmaron con el `data.id` en minúsculas y ninguna «tal cual»; se retira la variante «tal cual». `verificar_firma_webhook` valida una sola vez con `data_id.lower()` y se elimina el log `INFO` temporal de la variante (D6 adelantado), conservando el `WARNING` de firma inválida.

## Bloque 10 y revisión SOLID/DRY (tarea 11.3, 2026-11-21)

- **10.2 RED**: `test_pago_webhook_firma.py` con el id tal cual → 401 sin consultar ni cambiar nada (falló: devolvía 200) y «id que ya viene en minúsculas se acepta». **10.3 GREEN**: `verificar_firma_webhook` valida una vez con `data_id.lower()`; se quitó el log `INFO` temporal de la variante (D6 adelantado) y se conservó el `WARNING` de firma inválida. `tests/unit/test_firma_webhook.py` pasó a: minúsculas aceptada, ya-minúsculas aceptada, tal cual rechazada, otro id rechazado con log sin secretos, otra clave rechazada. En `tests/support/mp_webhook.py` solo `firmar_id=order_id` firma tal cual, y los tests que lo usan afirman rechazo.
- **Capas**: el router no tiene lógica (lee la notificación con la dependencia `leer_notificacion`, delega en el service y arma `WebhookRespuesta`); entre service y router viaja `ResultadoWebhook` (dataclass) y no `dict`; el service solo orquesta, y el mapeo de estados (`estado_local_para`), el control del monto (`monto_coincide`) y la idempotencia (`decidir_transicion_pago`) son funciones puras en `decision_webhook.py` sin I/O; `pasarela_mp` es el único módulo que conoce el SDK y expone `total_amount` ya como `Decimal`.
- **DRY corregido**: las constantes de estado del pago estaban duplicadas entre `service.py` y `decision_webhook.py` (y `"a_devolver"` como literal); ahora `decision_webhook.py` es la fuente (`ESTADO_PENDIENTE`, `ESTADO_RECHAZADO`, `ESTADO_APROBADO`, `ESTADO_A_DEVOLVER`) y `service.py` las reexporta con los nombres previos.
- **Reportado, no cambiado** (fuera de alcance): `decision_cobro._ESTADOS_QUE_BLOQUEAN` repite el conjunto `{aprobado, a_devolver}` de `ESTADOS_TERMINALES` (dos decisiones puras independientes que hoy coinciden; unificarlas acoplaría los módulos).


## Cierre (tarea 11.1, 2026-11-21)

**Suite completa del backend: 1922 passed, 1 failed (1923 tests; línea base 1862 → +61)**. El único fallo, `tests/unit/test_limitador_por_clave.py::test_retry_after_es_el_tiempo_hasta_que_vence_el_fallo_mas_antiguo`, es un test de tiempo ajeno a este change (no toca `pagos`) y pasó 9/9 al correrlo solo (se corrió una consulta pytest en paralelo mientras la suite estaba en curso, lo que cargó la máquina). Tras el refactor DRY de constantes se repitieron los tests de pagos, firma, decisiones y flujo de compra: 291 passed. `openspec validate endurecimiento-pagos-webhook --strict`: válido.
