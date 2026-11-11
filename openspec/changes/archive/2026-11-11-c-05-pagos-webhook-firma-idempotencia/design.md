# Design — C-05 `pagos-webhook-firma-idempotencia`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/payment-api` (delta sobre la capability que crea C-04) y `specs/backend-config`.

**Punto de partida asumido: el código después de aplicar C-04.** C-05 SHALL aplicarse y archivarse con C-04 ya archivado (el delta `MODIFIED` de «Rutas públicas de pagos» lo exige: `openspec validate` hoy informa que el archivo lo rechazaría porque `payment-api` todavía no existe en `openspec/specs/`). Tras C-04:

- `PagoUnitOfWork` expone `pagos` (`PagoRepository`) y `pedidos` (`PedidoRepository`); `PaymentService` lee el pedido por la UoW y usa `AppError` para 403/404; `core/permissions.py` tiene `puede_acceder_a_propio`.
- El webhook y el redirect siguen públicos y **sin tocar** (C-04 D7): `router.webhook` con `try/except Exception` → 200 `{"status": "error"}`.

Estado relevante que C-04 no cambia (`dev`, 2026-11-11):

- `PaymentService.procesar_webhook(data, query_params)`: mezcla id del cuerpo y de la query; busca el `Pago` por `external_reference` → `mp_payment_id` → `merchant_order_id`; `already_processed` si `pago.estado != "pendiente"`; actualiza el pago y llama a `construir_pedido_service(uow._session).confirmar_por_pago_aprobado(pedido_id)` dentro de un `try/except Exception` que solo loguea.
- `PedidoService.confirmar_por_pago_aprobado` (C-09/C-10): con `with self._uow` decide `CONFIRMADO` o `CANCELADO` «Sin stock» (stock bloqueado con `get_for_update`, todo o nada) y aplica `_transicionar` con `ACTOR_SISTEMA`; si la FSM no permite al Sistema confirmar, `_transicionar` lanza `AppError(409, INVALID_TRANSITION)`. El paso de confirmación es inyectable (`PedidoService(uow, al_confirmar=...)`; `construir_pedido_service` usa `descontar_stock_al_confirmar`).
- `core/unit_of_work.py::UnitOfWork`: `__exit__` hace `commit` si no hubo excepción y `rollback` si la hubo. **No es reentrante**: dos UoW sobre la misma `Session` anidadas hacen que la interna confirme o revierta el trabajo de la externa.
- Tests: sesión por test con `join_transaction_mode="create_savepoint"`; `test_pago_webhook_fsm.py` mockea `mercadopago.SDK` (borde) y postea sin firma; `test_pedidos_fsm.py` inyecta un paso de confirmación que falla vía `app.dependency_overrides`.
- SDK `mercadopago` 3.6.0 instalado con `mercadopago.webhook.WebhookSignatureValidator.validate(x_signature, x_request_id, data_id, secret, *, tolerance_seconds=None, now=None)` (HMAC-SHA256, `hmac.compare_digest`, omite pares ausentes, `ts` en milisegundos) y `InvalidWebhookSignatureError(reason, request_id, timestamp)`. `requirements.txt` lista `mercadopago` sin versión.
- `pagos.mp_payment_id` (`BIGINT UNIQUE`) e `idempotency_key` (`UNIQUE NOT NULL`) ya existen (migración `001`).

## Goals / Non-Goals

**Goals:** autenticar el origen del webhook, hacer que procesar una notificación sea idempotente y atómico, y que el código HTTP le diga a MercadoPago la verdad (reintentá / no reintentes), sin cambiar el contrato de los demás endpoints ni el esquema.

**Non-Goals:** reembolsos o reacción a `refunded`/`cancelled` posteriores (PA-08); procesar `merchant_order` o el IPN legacy (`?id=&topic=`); Checkout API (C-12); ventana de tiempo sobre `ts` (ver D3); procesamiento asíncrono en cola; bloqueo del pedido frente a una cancelación manual simultánea (ver Riesgos).

## Decisions

**D1 — Validación de firma con el validador del SDK, encapsulada en un adaptador.**
Nuevo `app/modules/pagos/firma_webhook.py` con `verificar_firma_webhook(x_signature: str | None, x_request_id: str | None, data_id: str | None, secreto: str) -> None` que delega en `WebhookSignatureValidator.validate` y traduce `InvalidWebhookSignatureError` a `AppError(401, "HTTP_401", "Firma de webhook inválida")`, logueando `reason` y `x-request-id` (nunca el secreto ni el hash). Se fija `mercadopago>=3.6.0` en `requirements.txt`.
*Por qué:* es la implementación oficial del manifest (incluida la omisión de pares ausentes y la comparación en tiempo constante); el adaptador aísla al service de la librería y es el único punto a cambiar si MercadoPago versiona la firma.
*Alternativa descartada:* reimplementar el HMAC a mano (`hmac.new(...).hexdigest()` + `compare_digest`): es corto, pero duplica una regla del proveedor y abre la puerta a errores sutiles del manifest. Si el validador no existiera en la versión desplegada, el fallback es esa misma función pura (se testea igual).
*Tests:* **no se mockea el validador**; un helper `tests/support/mp_firma.py::firmar(data_id, request_id, ts, secreto)` calcula el HMAC real y arma el header, de modo que los tests prueban la firma de punta a punta.

**D2 — Secreto obligatorio para el webhook: falla cerrado con 503.**
`Settings.MP_WEBHOOK_SECRET: Optional[str] = None` (convención DD-18: `None` = no configurado). En el webhook, el primer chequeo es `MP_WEBHOOK_SECRET`; si falta → `AppError(503, "HTTP_503", "MercadoPago no configurado: falta MP_WEBHOOK_SECRET")` antes de leer la firma.
*Por qué 503 y no aceptar sin firma:* aceptar notificaciones sin verificar en cualquier entorno reabre DT-06 por omisión de configuración; un 503 es visible, MercadoPago reintenta (no se pierde el evento cuando se configura) y es coherente con el resto del grupo de pagos (`backend-runtime`, «Pagos sin MercadoPago configurado»). En tests el secreto se fija con `monkeypatch.setattr(settings, "MP_WEBHOOK_SECRET", ...)`.
*Alternativa descartada:* «modo desarrollo» que saltea la firma con `ENVIRONMENT=development`: es un interruptor de seguridad atado a una variable que no es de seguridad.

**D3 — Sin ventana de tolerancia sobre `ts` (por defecto).**
Se llama al validador con `tolerance_seconds=None`.
*Por qué:* MercadoPago reintenta durante horas (cada 15 min según el SDK) y no está documentado si re-firma con un `ts` nuevo; una ventana corta podría rechazar reintentos legítimos y perder confirmaciones. El riesgo de *replay* de una notificación auténtica es bajo: el webhook **no confía en el payload** (RN-PA-03, consulta el pago a la API de MercadoPago) y el procesamiento es idempotente (D5), así que reproducirla no produce efectos nuevos.
*Alternativa:* `tolerance_seconds` configurable (p. ej. 300) con `freezegun`/`now=` en tests. Queda como OQ-2; activarla no cambia specs ni tareas salvo una variable más.

**D4 — Orden del pipeline y códigos.**
`router.webhook` (sin `try/except`, sin lógica) lee `x-signature`, `x-request-id`, la query y el cuerpo (JSON o form) y llama a `PaymentService.procesar_webhook(NotificacionWebhook)` (dataclass/`BaseModel` con esos campos). El service, en este orden:
1. `MP_WEBHOOK_SECRET` → 503.
2. Firma sobre el `data.id` **de la query** (lo que firma MercadoPago) → 401.
3. Resolver tópico (`type`/`topic`, query o cuerpo) e id: id = `data.id` de la query; si no hay, el del cuerpo; si ambos y difieren → `AppError(400, "HTTP_400", ...)`. Tópico ≠ `payment` o sin id → 200 `ignored`.
4. `MP_ACCESS_TOKEN` → 503.
5. Consultar el pago a MercadoPago (borde); `status != 200` o excepción del SDK → `AppError(502, "HTTP_502", "No se pudo consultar el pago en MercadoPago")`. Estado no mapeado → 200 `ignored`.
6. Transacción única (D6) con bloqueo e idempotencia (D5).
Cualquier otra excepción sube al `unhandled_exception_handler` existente → 500 `INTERNAL_ERROR`, y la UoW ya revirtió. El router dispara el WebSocket solo si la respuesta trae `pedido_actualizado` (como hoy); las background tasks corren después del `commit`.
*Por qué 401 (no 403) para firma inválida:* es lo que documenta MercadoPago para su validador y separa «no autenticado» de «autenticado sin permiso». *Por qué 502 para la consulta fallida:* el fallo es de la dependencia aguas arriba y debe reintentarse.
*Notificaciones legacy IPN* (`?id=&topic=payment`, sin `x-signature`): reciben 401. Se documenta configurar solo «Webhooks» en el panel de MercadoPago (Riesgos).

**D5 — Idempotencia por id de pago de MercadoPago con bloqueo de fila.**
`PagoRepository` gana lecturas con `with_for_update()` (patrón de `ProductoRepository.get_for_update`): `get_by_mp_payment_id_for_update(id)` y `get_ultimo_by_pedido_for_update(pedido_id)`. Resolución, siempre bloqueando la fila: (a) por `mp_payment_id`; (b) si no, por `external_reference` → último pago del pedido; (c) si no, por `merchant_order_id`; si nada → 200 `ignored`. Con la fila bloqueada, la decisión es pura (función `decidir_transicion_pago(estado_local, mp_payment_id_local, mp_payment_id, nuevo_estado) -> Accion`, testeable unitariamente):
- estado local `aprobado` o `a_devolver` → `already_processed` (terminales hasta PA-08);
- mismo `mp_payment_id` y mismo estado local resultante → `already_processed`;
- `pendiente` → `pendiente|rechazado|aprobado` y `rechazado` → `aprobado|pendiente` (nuevo intento de la misma preferencia, otro `mp_payment_id`) → `procesar`.
La segunda notificación concurrente espera el lock y, al leer, ve el estado ya escrito → `already_processed` (spec «Notificaciones concurrentes»). El `UNIQUE` de `mp_payment_id` es la red de seguridad: si dos pagos locales intentaran tomar el mismo id, el `IntegrityError` revierte todo (500, reintento).
*`idempotency_key`:* se mantiene como clave de **creación** (UUID por intento, la que C-12 enviará a MercadoPago en `X-Idempotency-Key`); MercadoPago no la devuelve en la notificación, así que no puede ser la clave de dedupe del webhook. Se documenta en KB 05/11.
*Alternativa descartada:* tabla `pagos_eventos_webhook` con `x-request-id UNIQUE` (deduplicar por evento). Requiere migración, no cubre reentregas con distinto `x-request-id` del mismo pago y el estado del pago ya es la fuente de verdad. **Sin migración** (D9).

**D6 — Una sola transacción: Unit of Work reentrante con savepoint.**
`UnitOfWork` lleva la profundidad en `session.info["uow_depth"]`:
- La más externa (`depth == 0`) se comporta como hoy: `commit` al salir sin error, `rollback` con error.
- Una anidada sobre la misma `Session` abre `session.begin_nested()` (SAVEPOINT) al entrar; al salir sin error libera el savepoint (no hace `commit`); con error hace `rollback` del savepoint y **re-lanza**.
Así `PaymentService` abre `PagoUnitOfWork`, actualiza el pago y llama a `confirmar_por_pago_aprobado`, cuyo `PedidoUnitOfWork` queda anidado: pago, transición, stock e historial se confirman en el único `commit` externo. Una falla inesperada adentro se propaga, la externa revierte todo → 500 (spec «Falla a mitad de la confirmación»). `UnitOfWork.commit()` explícito dentro de una anidada no confirma la transacción externa (solo la externa confirma).
*Por qué en `core`:* la regla «las capas no se acoplan» (reglas duras 1 y 4) prefiere que el service de pagos no conozca los internos de la UoW de pedidos; la reentrancia es genérica y sirve a futuros casos (C-12). Sin uso anidado previo en el código fuera del webhook (`construir_pedido_service(uow._session)` es el único), por lo que el resto no cambia de comportamiento; se cubre con tests unitarios de la UoW y con la suite completa.
*Alternativas descartadas:* (a) pasar la UoW de pagos a `PedidoService`: acopla pedidos a pagos; (b) un flag `commit=False` en `confirmar_por_pago_aprobado`: filtra detalles transaccionales a la API del service; (c) dos transacciones con compensación: más código y ventana de inconsistencia.
*Inyección para tests:* `PaymentService(session, construir_pedidos: Callable[[Session], PedidoService] = construir_pedido_service)`; `get_payment_service` sigue siendo la dependencia que el test sobrescribe con `app.dependency_overrides` para inyectar un `PedidoService` con un paso de confirmación que falla (mismo patrón que `test_pedidos_fsm.py`). Se elimina el acceso a `uow._session` desde pagos.

**D7 — Falla de negocio conocida explícita: 409 de la FSM → pago `a_devolver`, 200.**
Dentro de la transacción, `PaymentService` envuelve solo la llamada a `confirmar_por_pago_aprobado` y captura **únicamente** `AppError` con `code == ErrorCode.INVALID_TRANSITION` (el savepoint anidado ya revirtió lo que el service de pedidos hubiera tocado): el pago queda `a_devolver` con `mp_payment_id`/`mp_status` registrados, el pedido no cambia y se responde 200 `processed` sin `pedido_actualizado` (no hay WebSocket). Si `confirmar_por_pago_aprobado` devuelve el pedido `CANCELADO` (sin stock, C-10) → pago `a_devolver` (como hoy). Cualquier otra excepción no se captura.
*Por qué `a_devolver` y no dejar el pago `pendiente` o `aprobado`:* `pendiente` (comportamiento actual, accidental) hace que cada reentrega reprocese para siempre y oculta dinero cobrado; `aprobado` rompe el invariante «pago aprobado ⇒ pedido confirmado» (DT-21). `a_devolver` ya existe (C-10) y significa exactamente «MercadoPago cobró y no hay pedido que lo respalde». Ver OQ-1.
*Por qué no se usa el mensaje sino el código:* `INVALID_TRANSITION` es el código estable de la API (`api-conventions`).

**D8 — Sin cambios en `order-lifecycle` ni `order-stock`.** Sus escenarios del webhook («pago aprobado de un pedido `EFECTIVO`/`CANCELADO` → 200 y el pedido no cambia», «sin stock → `CANCELADO`, `a_devolver`, 200», «reenvío del pago `a_devolver`») siguen valiendo; C-05 solo agrega la parte del pago (`payment-api`). Los tests existentes de `test_pago_webhook_fsm.py` pasan a enviar notificaciones firmadas con el helper de D1.

**D9 — Sin migración Alembic.** Las restricciones necesarias (`mp_payment_id UNIQUE`) existen; el bloqueo es `SELECT … FOR UPDATE`; `a_devolver` cabe en `estado VARCHAR(20)`. Si durante apply algo pareciera requerir esquema, frenar y consultar (regla dura 9).

**D10 — Variable nueva y documentación.** `MP_WEBHOOK_SECRET` en `core/config.py` (opcional), en `backend/.env.example` con placeholder falso (requisito de cobertura de `backend-config`; el valor real solo en `.env` local, nunca commiteado) y en KB 08. El agente de apply no puede leer ni escribir `.env*` (regla de permisos del entorno): la línea de `.env.example` la agrega el usuario o se autoriza explícitamente esa edición (tarea 1.4).

## Risks / Trade-offs

- [Notificaciones legacy IPN sin firma reciben 401 y MercadoPago las reintenta] → configurar en el panel solo «Webhooks» (evento `payment`); documentarlo en KB 11 §Sandbox. Las del formato Webhooks siempre vienen firmadas.
- [Sin `MP_WEBHOOK_SECRET` en un entorno con MP configurado, los pagos aprobados no confirman pedidos] → 503 explícito y logueado; MercadoPago reintenta y el pedido se confirma cuando se configura el secreto. Documentado en KB 08/11.
- [Sin ventana de `ts`, una notificación auténtica capturada puede reenviarse] → sin efecto: el estado se toma de la API de MercadoPago y el procesamiento es idempotente (D3, D5). OQ-2.
- [La UoW reentrante cambia `core`] → la externa conserva el comportamiento actual; tests unitarios de anidamiento (commit externo único, rollback del savepoint, re-lanzamiento) y suite completa como red de seguridad.
- [Lock sobre `pagos` + lock sobre `productos` (C-10): posible espera entre webhooks concurrentes de pedidos distintos que comparten productos] → orden fijo: primero el pago, luego productos por `id` ascendente (C-10); no hay ciclos. Tiempo de respuesta muy por debajo de los 22 s de MercadoPago.
- [Una cancelación manual del pedido concurrente con el webhook] → la FSM la serializa a nivel lógico pero el pedido no se bloquea; el peor caso es un 409 en una de las dos operaciones (el webhook lo trata como D7). Bloquear el pedido queda fuera de alcance.
- [`a_devolver` para pedidos `EFECTIVO`/ya confirmados genera trabajo manual] → es dinero cobrado sin respaldo; reembolso automático es PA-08.
- [Cambio incompatible del webhook] → solo lo consume MercadoPago; no hay frontend que dependa del `{"status": "error"}`.

## Migration Plan

Sin migración Alembic. Despliegue: definir `MP_WEBHOOK_SECRET` (panel de MercadoPago → la aplicación → Webhooks → clave secreta) en el `.env` del backend **antes** de desplegar; si no, el webhook responde 503 y MercadoPago reintenta hasta que se configure. Rollback = revertir el commit (no hay datos nuevos que limpiar; los pagos `a_devolver` creados por D7 siguen siendo válidos para el código anterior).

## Open Questions

> Gobernanza CRÍTICA: cada decisión tiene un valor por defecto aplicado en las specs; el usuario lo confirma (o cambia) al aprobar la propuesta, antes de `/opsx:apply`.

- **OQ-1 — Pago aprobado de un pedido que el Sistema no puede confirmar (`CANCELADO`, `EFECTIVO`/`TRANSFERENCIA`, ya confirmado):** por defecto, pago `a_devolver` + 200 (D7). Alternativa: dejar el pago `aprobado` sin tocar el pedido (rompe el invariante DT-21) o `pendiente` (comportamiento actual accidental).
- **OQ-2 — Ventana de tolerancia sobre `ts`:** por defecto, ninguna (D3). Alternativa: rechazar con 401 notificaciones con `ts` a más de N segundos (p. ej. 300), con una variable más.
- **OQ-3 — Webhook sin `MP_WEBHOOK_SECRET`:** por defecto, 503 en todo entorno (D2). Alternativa: aceptar sin firma solo con `ENVIRONMENT=development` (desaconsejado).

**Resueltas (aprobadas 2026-11-11 por el usuario, con los valores por defecto):**
- **OQ-1 resuelta:** SI. Pago aprobado de un pedido que el Sistema no puede confirmar -> pago `a_devolver` + 200.
- **OQ-2 resuelta:** NO hay ventana de tolerancia sobre `ts` de la firma.
- **OQ-3 resuelta:** sin `MP_WEBHOOK_SECRET` el webhook falla cerrado con 503 en todo entorno, sin bypass de desarrollo.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-11
