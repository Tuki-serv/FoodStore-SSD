# Design — C-10 `pedidos-stock-descuento`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/order-stock` (nuevo) y `specs/order-lifecycle` (MODIFIED).

Punto de partida (C-09, `backend/app/modules/pedidos/service.py`):

- `_transicionar(uow, pedido, destino, actor, motivo)` es el único lugar que aplica transiciones: valida con `fsm.destinos_permitidos`, actualiza el estado, llama a `self._al_confirmar(uow, pedido)` si el destino es `CONFIRMADO`, llama a `restaurar_stock_del_pedido` en **toda** cancelación y escribe el historial.
- `crear_pedido` valida stock **por línea** y después llama a `descontar_stock_del_pedido` (bloqueo por línea, en el orden de los detalles).
- Webhook (`pagos/service.py`): dentro de `with PagoUnitOfWork(session)` marca el pago `aprobado` y llama a `construir_pedido_service(session).confirmar_por_pago_aprobado(...)`, que abre **otro** `with uow` sobre la **misma** sesión. Si ese bloque lanza, su `__exit__` hace `rollback()` de la sesión compartida y se pierde también el cambio del pago (IN-22); el `except` del webhook solo loguea.
- `ProductoRepository.get_for_update(id)` ya existe (`SELECT ... FOR UPDATE`). `ProductoService.fijar_stock` (C-08) lee sin bloqueo y asigna el valor absoluto.
- `pagos.estado` es `VARCHAR(20)` sin `CHECK` (migración 001); valores en uso: `pendiente`, `aprobado`, `rechazado`.

## Goals / Non-Goals

**Goals:** stock descontado solo al confirmar y devuelto solo desde `CONFIRMADO`/`EN_PREP`, todo en la transacción de la transición; un único `StockService`; sin sobreventa bajo concurrencia; el caso «pagado sin stock» resuelto **sin lanzar excepciones** dentro del webhook (así no dispara IN-22).

**Non-Goals:** arreglar IN-22 en general (otras excepciones del webhook → C-05); devolución automática (PA-08); `disponible=false` automático (PA-12); `HTTPException` fuera de los services (C-25a).

## Decisions

**D1 — `StockService` en `productos/stock_service.py`, agnóstico de pedidos.**
Recibe un `ProductoRepository` y trabaja con líneas `LineaStock(producto_id: int, cantidad: int)` (dataclass inmutable). API: `verificar(lineas)` (sin bloqueo, para crear), `alcanza(lineas) -> Producto | None` (con bloqueo; devuelve el primer producto que no alcanza), `descontar(lineas)` y `devolver(lineas)`. Internamente: agrupa por `producto_id` sumando cantidades, ordena por `producto_id` ascendente y bloquea con `get_for_update`. `descontar` verifica **todas** las líneas antes de escribir ninguna y lanza `StockInsuficiente(producto_nombre)` (excepción de dominio, no `HTTPException`). `PedidoService` arma las líneas desde `uow.detalles` con un helper privado.
*Alternativa descartada:* dejar los métodos en `PedidoService` (viola «un único servicio de stock» y mezcla dominios) o un `StockService` que conozca `Pedido` (acopla productos a pedidos).

**D2 — Orden de bloqueo por `producto_id`.** Dos transacciones bloquean siempre en el mismo orden ⇒ no hay deadlock aunque los detalles estén en distinto orden. El bloqueo dura hasta el commit del UoW de la transición.

**D3 — Gancho de confirmación conectado en la fábrica.** `construir_pedido_service(session)` pasa `al_confirmar=descontar_stock_al_confirmar`, una función del módulo de pedidos que arma las líneas y llama a `StockService(uow.productos).descontar(...)`. La firma `PasoConfirmacion` de C-09 no cambia. `_transicionar` llama a `StockService.devolver` solo si el destino es `CANCELADO` **y** el origen es `CONFIRMADO` o `EN_PREP`.

**D4 — Confirmación manual sin stock → 409.** `cambiar_estado_pedido` deja propagar `StockInsuficiente` fuera del `with uow` (rollback completo: estado, historial y stock quedan como estaban) y la traduce a `HTTPException(409, "No hay stock suficiente para <producto>")`.

**D5 — Pago aprobado sin stock: pre-chequeo con bloqueo, sin excepción.** `confirmar_por_pago_aprobado` (único camino del webhook):
1. Valida con la FSM que el Sistema puede confirmar (si no, el 409 de siempre, como hoy).
2. `StockService.alcanza(lineas)` bloquea las filas en orden y mira si alcanza.
3. Si alcanza → `_transicionar(..., CONFIRMADO, ACTOR_SISTEMA, ...)` (el descuento reusa los bloqueos ya tomados en la misma transacción).
4. Si no → `_transicionar(..., CANCELADO, ACTOR_SISTEMA, "Sin stock")`; no se devuelve nada (origen `PENDIENTE`).
Devuelve `PedidoReadFull`; el webhook mira `estado_codigo == CANCELADO` y pone el pago en `a_devolver`. Como no hay excepción, el `with uow` interno hace commit y el cambio del pago no se pierde.
*Alternativa descartada:* intentar confirmar, capturar `StockInsuficiente` y cancelar con un savepoint (`begin_nested`): más piezas, y el estado ya mutado del ORM complica el manejo.

**D6 — FSM: el Sistema puede `PENDIENTE → CANCELADO`, solo en pedidos `MERCADOPAGO`.** `TRANSICIONES[SISTEMA]` pasa a `{PENDIENTE: {CONFIRMADO, CANCELADO}}` y `destinos_permitidos` le quita al Sistema todo destino si la forma de pago no es `MERCADOPAGO` (hoy solo filtraba `CONFIRMADO`), así la regla «solo pedidos `MERCADOPAGO`» vive en la tabla pura y no en el llamador. Ningún usuario humano puede tomar el rol `SISTEMA` (`Actor.usuario` lo descarta).

**D7 — Marca de devolución: nuevo valor `a_devolver` en `pagos.estado`, sin migración.** La columna es texto libre de 20 caracteres sin `CHECK`; `mp_status` conserva `approved` como evidencia. El reenvío del webhook cae en el `pago.estado != "pendiente"` actual → `already_processed`. *Alternativa:* columna booleana `requiere_devolucion` (migración 003): más explícita pero agrega esquema para un caso de borde (ver OQ-1).

**D8 — Crear el pedido verifica con `StockService.verificar`** (sumando líneas del mismo producto, sin bloqueo) y conserva los 400 y mensajes actuales («Producto no disponible», «No hay stock suficiente»). Se borra la llamada a `descontar_stock_del_pedido`. Sin bloqueo porque crear no escribe stock: la garantía real está en la confirmación.

**D9 — `fijar_stock` lee con `get_for_update`.** El valor sigue siendo absoluto (contrato C-08), pero la lectura bloqueada evita que el ORM omita el `UPDATE` cuando el valor leído coincide con el pedido mientras otro descuento cambió la fila en el medio, y serializa la escritura con las confirmaciones. Sin cambios de spec en `catalog-stock-management`.

**D10 — Devolución a productos eliminados:** se mantiene el comportamiento actual (se saltean). Un producto con `deleted_at` no vuelve al catálogo, así que sumar stock no tiene efecto útil.

## Risks / Trade-offs

- [Pedidos `PENDIENTE` que nunca se confirman ya no inmovilizan stock, pero tampoco lo garantizan: un cliente puede pagar y quedarse sin producto] → es la decisión DD-20; el caso queda cubierto por D5 (cancelación + `a_devolver`).
- [`a_devolver` sin proceso de devolución] → el admin lo ve en el pago; la devolución real es PA-08. Se documenta en KB 11.
- [IN-22 sigue abierto para otras excepciones del webhook] → D5 evita el caso de stock; el resto es C-05.
- [Tests de concurrencia necesitan commits reales] → mismo patrón que `test_auth_refresh_concurrente.py` (sesiones propias por hilo, datos creados y borrados por el test).
- [Tests existentes que asumen descuento al crear o restauración desde `PENDIENTE`] → la red de seguridad (0.1) los identifica; se ajustan en el grupo que cambia el comportamiento.

## Migration Plan

Sin migración Alembic ni variables nuevas. Rollback = revertir el commit. Los pedidos `PENDIENTE` existentes creados con la lógica vieja ya descontaron stock; en el entorno de desarrollo se resuelve re-sembrando (`python -m app.db.seed`) — no hay datos productivos.

## Open Questions

- **OQ-1 — ¿Cómo se marca el pago a devolver?** Por defecto: nuevo valor de estado `a_devolver` (sin migración). Alternativa: columna booleana nueva (migración 003). **Resuelta: se usa el valor `a_devolver`, sin migración (aprobado 2026-11-11, por el usuario).**
- **OQ-2 — Motivo del cancelado automático.** Por defecto: «Sin stock». Se puede cambiar el texto sin tocar nada más. **Resuelta: «Sin stock» (aprobado 2026-11-11, por el usuario).**
- **OQ-3 — ¿El ajuste manual de stock bloquea la fila?** Por defecto: sí, sigue siendo valor absoluto pero se lee con bloqueo (D9). Alternativa: dejarlo como está. **Resuelta: se lee con bloqueo, valor absoluto (aprobado 2026-11-11, por el usuario).**

## Deviaciones durante apply

- `StockService.descontar/devolver` hacen `flush()` al terminar (el `update` del repositorio base no lo hace) para que el stock sea visible dentro de la transacción.
- Un producto eliminado (soft delete) cuenta como faltante en `alcanza`/`descontar` (409 «No hay stock suficiente para X», antes 404) y se saltea en `devolver` (D10).
- `StockService` define además `ProductoNoDisponible`; `crear_pedido` la traduce al 400 «Producto no disponible» de siempre.
- `cambiar_estado_pedido` envuelve el `with uow` en `try/except StockInsuficiente` (409 fuera del UoW).

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI) — 2026-11-11
