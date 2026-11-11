# Proposal — C-05 `pagos-webhook-firma-idempotencia`

## Why

`POST /api/v1/pagos/webhook` es la única vía por la que un pedido `MERCADOPAGO` pasa a `CONFIRMADO` y descuenta stock, pero hoy **acepta cualquier request sin verificar que venga de MercadoPago** (DT-06), **deduplica solo por `pago.estado != "pendiente"`** (DT-20), **puede dejar el pago y el pedido inconsistentes** porque el cambio de estado corre en una transacción anidada que confirma por su cuenta (DT-21, IN-22) y **responde siempre 200**, incluso ante errores, así que MercadoPago nunca reintenta (KB 11 §Riesgos conocidos, KB 07 Flujo 5). La spec `[INT]` (DD-07) pide webhook con firma validada, idempotencia real y consistencia pago/pedido. Es el último change de seguridad de pagos de Fase 0 (gobernanza CRÍTICA) y C-12 (Checkout API) se apoya en él.

Observado en el código (`dev`, 2026-11-11, antes de C-04):

- `pagos/router.py::webhook` envuelve todo en `try/except Exception` y devuelve 200 `{"status": "error"}`; no lee `x-signature` ni `x-request-id`.
- `PaymentService.procesar_webhook` toma el id de pago del cuerpo o de la query sin distinguir cuál está firmado; busca el `Pago` primero por `external_reference` (último pago del pedido), luego por `mp_payment_id`; si `pago.estado != "pendiente"` responde `already_processed` (un pago `rechazado` nunca vuelve a procesarse, aunque el cliente pague de nuevo la misma preferencia).
- La confirmación llama a `construir_pedido_service(uow._session).confirmar_por_pago_aprobado(...)`, cuyo `with self._uow` **hace `commit` al salir** dentro del `PagoUnitOfWork` externo: no hay una sola transacción. Si la FSM rechaza la transición (409: pedido `EFECTIVO`, `CANCELADO` o ya `CONFIRMADO`), el `rollback` interno **descarta también la actualización del pago**, el `except` lo traga con un `warning` y el pago queda `pendiente` para siempre.
- El caso «pago aprobado sin stock» ya está resuelto por C-10 (pedido `CANCELADO` «Sin stock», pago `a_devolver`, 200) y el actor Sistema por C-09 (`usuario_id` NULL): se conservan.
- El SDK instalado (`mercadopago` 3.6.0) trae `mercadopago.webhook.WebhookSignatureValidator` (HMAC-SHA256 con comparación en tiempo constante); `requirements.txt` no fija versión.
- `pagos.mp_payment_id` e `idempotency_key` ya tienen `UNIQUE` (migración `001`).

## What Changes

- **BREAKING — Firma obligatoria:** el webhook valida `x-signature` (`ts=…,v1=…`) contra el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con HMAC-SHA256 y la clave secreta de la aplicación (`MP_WEBHOOK_SECRET`). Firma ausente, mal formada o que no coincide → **401** `HTTP_401`, sin consultar a MercadoPago ni tocar la base. El id de pago que se procesa es el **firmado** (`data.id` de la query).
- **Nueva variable opcional `MP_WEBHOOK_SECRET`** (grupo de pagos, nunca commiteada). Sin ella el webhook **falla cerrado**: **503** `HTTP_503` nombrando `MP_WEBHOOK_SECRET`, sin procesar nada (MercadoPago reintenta). Un evento `payment` firmado sin `MP_ACCESS_TOKEN` también responde 503.
- **Idempotencia real por id de pago de MercadoPago:** el `Pago` se resuelve primero por `mp_payment_id` y se bloquea (`SELECT … FOR UPDATE`) antes de decidir; una reentrega del mismo pago con el mismo estado, o cualquier evento sobre un pago ya `aprobado`/`a_devolver`, responde 200 `already_processed` sin cambios. Un pago `rechazado` sí acepta un pago aprobado posterior de la misma preferencia. `idempotency_key` queda documentado como la clave de **creación** del pago (la que C-12 envía en `X-Idempotency-Key`), no del webhook. **Sin migración.**
- **Una sola transacción pago/pedido:** la actualización del pago, la transición de la FSM (actor Sistema), el descuento de stock (C-10) y el historial se confirman juntos o no se confirma nada. La Unit of Work pasa a ser **reentrante** sobre la misma sesión (la interna usa un savepoint y solo la externa hace `commit`).
- **BREAKING — Códigos de respuesta del webhook:** 200 para procesado, ignorado, duplicado y **fallas de negocio conocidas** (sin stock, o pedido que el Sistema no puede confirmar); **502** si la consulta a MercadoPago falla y **500** ante cualquier falla inesperada, con rollback completo, para que MercadoPago reintente. Desaparece el `{"status": "error"}` con 200.
- **Pago aprobado de un pedido que el Sistema no puede confirmar** (pedido `CANCELADO`, `EFECTIVO`/`TRANSFERENCIA` o ya confirmado): la FSM sigue rechazándolo (el pedido no cambia, sin historial) y el pago queda **`a_devolver`** (como el caso sin stock) en lugar de quedar `pendiente`; responde 200. Así se mantiene el invariante «pago `aprobado` ⇒ pedido confirmado».
- El router queda sin `try/except` ni lógica: extrae headers, query y cuerpo, delega al service y dispara el WebSocket solo si hubo cambio de estado del pedido.

**Fuera de alcance (con dueño):** reembolso automático o cancelación del pedido ante un pago `cancelled`/`refunded` posterior `[PENDIENTE DE DECISIÓN: PA-08]`; migración a Checkout API, retiro del redirect y `float(monto)` → `Decimal` (C-12); sacar los `HTTPException` restantes de `PaymentService` (C-25a); notificaciones `merchant_order`/IPN legacy (se ignoran o rechazan, ver design).

## Orden respecto de C-04

C-05 **depende de C-04** (proposed, no aplicado): `C-04` crea la capability `payment-api`, mueve `PaymentService` a leer el pedido por `PagoUnitOfWork` (con `pedidos`) y declara el webhook público. C-05 **SHALL aplicarse y archivarse después de que C-04 esté archivado**: su delta `MODIFIED` sobre «Rutas públicas de pagos» y el design asumen el código posterior a C-04. C-05 no edita los requisitos que C-04 agrega sobre crear/consultar pagos ni el requisito «Pagos sin MercadoPago configurado» de `backend-runtime` que C-04 modifica.

## Capabilities

### New Capabilities
- (ninguna)

### Modified Capabilities
- `payment-api` (la crea C-04): se agregan los requisitos del webhook —firma, configuración requerida, id procesado, idempotencia, consistencia transaccional, códigos de respuesta y pago aprobado no confirmable— y se modifica «Rutas públicas de pagos» (público respecto del usuario, pero firmado).
- `backend-config`: `MP_WEBHOOK_SECRET` se suma a las variables opcionales del grupo de pagos y a las variables de MercadoPago con nombre de la spec.

## Impact

- **Código**: `core/unit_of_work.py` (reentrante con savepoint); `pagos/router.py` (webhook sin `try/except`, pasa headers/query/cuerpo); `pagos/service.py` (validación de firma, resolución del id firmado, bloqueo e idempotencia, una transacción, manejo explícito del 409 de la FSM, 502/500); `pagos/repository.py` (`get_by_mp_payment_id_for_update` o equivalente); `core/config.py` (`MP_WEBHOOK_SECRET`); `requirements.txt` (fijar `mercadopago>=3.6.0`, que trae el validador).
- **API**: cambios incompatibles en `POST /api/v1/pagos/webhook` listados arriba. Ningún otro endpoint cambia.
- **Tests**: nuevo `tests/integration/test_pago_webhook_firma.py` y `tests/integration/test_pago_webhook_idempotencia.py`; helper de firma en `tests/support/` (firma real con un secreto de test, sin mockear el validador); `test_pago_webhook_fsm.py` y `test_pago.py` pasan a enviar notificaciones firmadas; `tests/unit/test_unit_of_work.py` (reentrancia).
- **Datos**: sin migración (las restricciones `UNIQUE` necesarias ya existen).
- **Config**: `MP_WEBHOOK_SECRET` en `backend/.env.example` con placeholder falso (requisito de cobertura de `backend-config`); el valor real solo en `.env` local.
- **Docs**: `knowledge-base/07` (Flujo 5), `09` (DT-06, DT-20, DT-21 resueltas; DT-13 cerrada), `11` (tabla objetivo/actual, estados locales, §Riesgos conocidos), `05` (RN-PA-02, RN-PA-03), `08` (variables de entorno), `CHANGES.md` (C-05 `[x]` al archivar).
