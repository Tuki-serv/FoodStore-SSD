# Proposal — `endurecimiento-pagos-webhook` (ajuste extra fuera del plan)

> **Governance CRÍTICO** (pagos, regla dura 11): este change **solo se propone**. No se escribe código, no se corre el sandbox de MercadoPago y no se commitea hasta que el usuario dé el OK explícito (tarea 0.1) y responda OQ-1..OQ-3 de `design.md`; los specs asumen la opción recomendada de cada una, marcada como tal. Sin UI (`Decision: no (no UI)`).

## Why

El verify de C-12 (2026-11-16, PASS WITH FINDINGS) dejó nueve hallazgos menores sobre el cobro y el webhook de MercadoPago que se derivaron a C-25a («Heredado de C-12» en `CHANGES.md`); como C-25a ya estaba cerrado, quedaron sin dueño. Antes de la entrega (C-25b, que graba el video del flujo compra→pago) conviene cerrarlos: hoy el webhook confirma un pedido sin mirar el monto cobrado, devuelve el pedido completo a MercadoPago, bloquea el event loop con I/O sincrónica y tiene un mapeo de estados y una variante de firma que la spec no termina de fijar. Además el seed de la base falla en la consola de Windows, que es la del equipo de desarrollo.

Observado en el repo (`dev`, 2026-11-20; detalle con archivo:línea en `design.md` §Hallazgos):

- `PaymentService._estado_local_para` (`backend/app/modules/pagos/service.py:188-196`) mapea `partially_refunded → aprobado`, que no está en la spec; `canceled`, `charged_back`, `created` y `partially_refunded` no tienen test directo.
- El webhook (`router.py:78-92`) devuelve el `dict` del service tal cual: `{"status", "pago_id", "pedido_actualizado": PedidoDetalle}` o `{"status", "reason"}`.
- `procesar_webhook` (`service.py:211`) y el handler (`router.py:79`) son `async def` y llaman sincrónicamente al SDK (`requests`) y a PostgreSQL.
- `ResultadoMP` (`pasarela_mp.py:56-63`) no lee el `total_amount` de la orden: un `processed` confirma el pedido sin comparar el monto con `pagos.transaction_amount`.
- La ausencia de secretos en los logs se prueba solo en el adaptador (`tests/unit/test_pasarela_mp.py:231`), no por los endpoints.
- `verificar_firma_webhook` (`firma_webhook.py:20`) acepta el `data.id` en minúsculas y «tal cual»; el sandbox mostró que MercadoPago firma en minúsculas.
- Casos de sandbox sin correr: `OTHE`, `CONT` y clave de idempotencia repetida (OQ-14 de C-12).
- `app/db/seed.py:128,132` imprime `✅` **dentro** de la transacción: con stdout en cp1252 lanza `UnicodeEncodeError` y el seed revierte todo.

## What Changes

- **Mapeo de estados de la orden**: tests directos de `canceled`, `charged_back`, `created` (y del resto de la tabla). `partially_refunded → aprobado` pasa a la spec (OQ-1, recomendado) con su test.
- **Respuesta del webhook** **BREAKING (sin consumidores: solo la lee MercadoPago, que mira el código HTTP)**: el cuerpo 200 es exactamente `{"status": "processed" | "already_processed" | "ignored"}`; sin `pago_id`, `reason` ni el `PedidoDetalle`. El WebSocket del pedido se sigue disparando igual.
- **Webhook sin bloquear el event loop**: el handler y `procesar_webhook` pasan a `def` (FastAPI los corre en el threadpool); la lectura del cuerpo (`await request.json()/form()`) queda en una dependencia `async`.
- **Control del monto**: antes de confirmar un pago `aprobado` (webhook **y** creación sincrónica), el `total_amount` de la orden de MercadoPago SHALL coincidir con `pagos.transaction_amount`; si no coincide o falta, el pedido no se confirma, el pago queda `a_devolver` con los datos de MercadoPago registrados, se loguea un aviso sin secretos y el webhook responde 200 (OQ-3, recomendado).
- **Logs sin secretos, probado por los endpoints**: `POST /pagos/crear` y `POST /pagos/webhook` en sus caminos de error y de éxito no registran el access token, la clave secreta del webhook, el token de tarjeta ni el hash de `x-signature`.
- **Firma del webhook**: se retira la variante «tal cual»; solo vale el manifest con `data.id` en minúsculas (OQ-2, recomendado, **condicionado** a confirmar en sandbox que las notificaciones nuevas firman en minúsculas).
- **Sandbox manual (requiere al usuario)**: correr `OTHE`, `CONT` y la clave de idempotencia repetida (OQ-14) con ngrok y credenciales de prueba, y registrar los resultados en `design.md`.
- **Seed en Windows** (governance BAJO): la salida de `python -m app.db.seed` pasa a ASCII (sin emojis), así corre en una consola cp1252.
- **Docs al cerrar**: KB/11 (respuesta del webhook, control del monto, firma), KB/05 RN-PA-03, `CHANGES.md` (cierre del ajuste y del bullet «Heredado de C-12»).

**Fuera de alcance:** reembolsos automáticos o parciales (PA-08); flujo 3DS `action_required` (OQ-16 de C-12); ventana de tiempo del `ts` de la firma (OQ-2 de C-05); un estado de pago nuevo para «monto distinto» (se reutiliza `a_devolver`); cambios en el frontend (no consume la respuesta del webhook).

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `payment-api`: retira «Variantes del id en el manifest de la firma» y agrega «Id en minúsculas en el manifest de la firma» (OQ-2); cambia «Estados de la orden de MercadoPago» (suma `partially_refunded` y escenarios por estado), y «Códigos de respuesta del webhook» (cuerpo exacto `{status}`); agrega «El webhook no bloquea el event loop», «Control del monto antes de confirmar» y «Los logs de pagos no contienen secretos».
- `backend-db-seed`: agrega «Salida del seed compatible con la consola de Windows».

## Impact

- **Código backend**: `app/modules/pagos/{router.py, service.py, pasarela_mp.py, decision_webhook.py, firma_webhook.py, schemas.py}`, `app/db/seed.py`. Sin migración (no cambia el esquema: `a_devolver` ya existe y `transaction_amount` ya se guarda).
- **Tests**: `tests/support/mp_webhook.py` (el doble de la Orders API suma `total_amount`), `tests/integration/test_pago_webhook_*.py`, `test_pago_checkout_api.py`, `test_pago.py`, `test_flujo_compra_pago_entrega.py`, `test_seed.py`, `tests/unit/test_decision_pago_webhook.py`; nuevos `test_pago_webhook_respuesta.py`, `test_pago_logs_sin_secretos.py`.
- **API**: `POST /api/v1/pagos/webhook` (cuerpo de la respuesta 200 y firma «tal cual» → 401). `POST /pagos/crear` y `GET /pagos/{id}` no cambian de contrato; un cobro aprobado con monto distinto responde 201 `a_devolver`.
- **Frontend**: ninguno.
- **Operación**: sandbox con ngrok y credenciales `APP_USR-` del usuario para el bloque manual.
