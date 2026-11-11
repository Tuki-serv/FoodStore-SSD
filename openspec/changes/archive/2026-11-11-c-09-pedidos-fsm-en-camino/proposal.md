# Proposal — C-09 `pedidos-fsm-en-camino`

## Why

La spec (integrador v5.0 §3.4, `[INT]`) define una FSM de pedidos de **6 estados** (`PENDIENTE → CONFIRMADO → EN_PREP → EN_CAMINO → ENTREGADO` + `CANCELADO`), pero el código sigue con la tabla de 5 estados: no existe ninguna transición hacia `EN_CAMINO` y hay un atajo `EN_PREP → ENTREGADO` que la spec no admite (DT-03, IN-03). Además, cualquier ADMIN o PEDIDOS puede confirmar a mano **cualquier** pedido, incluso uno `MERCADOPAGO` que todavía no se pagó (DT-15, IN-20), cuando el usuario decidió que la confirmación manual es solo para `EFECTIVO`/`TRANSFERENCIA` (PA-06, DD-22). C-07 ya dejó `EN_CAMINO`(4) en el catálogo y C-08 ya evalúa la unión de roles: falta el contenido de la FSM. Es del camino crítico (`C-07 → C-09 → C-11`) y C-10 necesita un **único punto de entrada a CONFIRMADO** para enganchar ahí el descuento atómico de stock (DD-20).

Problemas observados en el código (`backend/app/modules/pedidos/service.py`, `backend/app/modules/pagos/service.py`, relevado el 2026-11-11 sobre `dev`):

- **FSM de 5 estados (DT-03)**: `TRANSICIONES` de ADMIN/PEDIDOS tiene `EN_PREP: {ENTREGADO, CANCELADO}` y no tiene fila `EN_CAMINO`. `PATCH /pedidos/{id}/estado` a `EN_CAMINO` responde 409.
- **Confirmación manual sin mirar la forma de pago (DT-15)**: `PENDIENTE → CONFIRMADO` está en la fila de ADMIN y PEDIDOS sin condición.
- **El webhook se hace pasar por ADMIN (DT-13, IN-21)**: `procesar_webhook` llama a `cambiar_estado_pedido(..., usuario_id=<dueño del pedido>, roles=frozenset({"ADMIN"}))`. El historial registra al **cliente** como actor de la confirmación. Si C-09 solo agregara la regla «un `MERCADOPAGO` no se confirma a mano», el webhook quedaría rechazado por su propia regla: el actor Sistema es condición necesaria de este change.
- **Dos caminos a CONFIRMADO**: el manual (`cambiar_estado_pedido` desde el router) y el automático (el mismo método llamado desde pagos con un rol prestado). No hay un lugar único donde C-10 pueda descontar stock.
- **Historial append-only sin garantía**: `HistorialEstadoPedidoRepository` hereda `update` y `delete` de `BaseRepository` (RN-PE-05, `[INT]` RN-03 dice «ninguna capa puede emitir UPDATE ni DELETE»). El orden es `created_at ASC` sin desempate.

## What Changes

- **FSM de 6 estados** (tabla `[INT]` §3.4, con la asignación de roles de DD-22/DD-23):

  | Origen | ADMIN / PEDIDOS | CLIENT (pedido propio) | Sistema |
  |---|---|---|---|
  | `PENDIENTE` | `CONFIRMADO` (solo `EFECTIVO`/`TRANSFERENCIA`), `CANCELADO` | `CANCELADO` | `CONFIRMADO` (solo `MERCADOPAGO`) |
  | `CONFIRMADO` | `EN_PREP`, `CANCELADO` | `CANCELADO` | — |
  | `EN_PREP` | `EN_CAMINO`, `CANCELADO` | — | — |
  | `EN_CAMINO` | `ENTREGADO` | — | — |
  | `ENTREGADO`, `CANCELADO` | — (terminales, 409) | — | — |

  Se elimina el atajo `EN_PREP → ENTREGADO`. `EN_CAMINO` no se cancela (la spec no tiene la flecha). La tabla se sigue consultando con la unión de los roles del usuario (C-08); `COCINA` y `STOCK` siguen sin fila (409).
- **Confirmación por forma de pago (DD-22)**: `PENDIENTE → CONFIRMADO` a mano solo para pedidos `EFECTIVO`/`TRANSFERENCIA`, y solo si el usuario tiene ADMIN o PEDIDOS. Un pedido `MERCADOPAGO` confirmado a mano recibe **409** con un mensaje propio y sigue `PENDIENTE` (OQ-4).
- **Actor Sistema para la confirmación automática**: el webhook de pago aprobado deja de usar el rol `ADMIN` prestado y el `usuario_id` del cliente. Confirma como actor **Sistema** (`usuario_id = NULL` en el historial), solo para pedidos `MERCADOPAGO` (OQ-1, OQ-2). El resto del webhook (firma, idempotencia, consistencia pago/pedido) sigue siendo de C-05.
- **Punto único de entrada a CONFIRMADO**: toda transición (manual, cancelación propia y automática) pasa por un único método privado de la FSM en `PedidoService`. Ese método invoca un *hook* de confirmación, vacío en C-09, donde C-10 engancha el descuento atómico de stock. La confirmación automática tiene un método público propio en el service; el webhook ya no arma un `PedidoCambioEstado`.
- **Historial append-only y ordenado**: cada transición inserta exactamente una fila (`estado_desde`, `estado_hacia`, actor, `motivo`). Una transición rechazada no inserta nada. El repositorio de historial no permite `update` ni `delete` (OQ-5). El historial se devuelve por `created_at ASC` con desempate por `id ASC`.
- **Cancelación**: `motivo` obligatorio (422 por validación del body, como hoy). El cliente cancela su pedido solo en `PENDIENTE` o `CONFIRMADO`. ADMIN y PEDIDOS cancelan además en `EN_PREP` (OQ-3). Nadie cancela en `EN_CAMINO` ni en estados terminales.
- **Sin cambio de contrato HTTP**: siguen `PATCH /pedidos/{id}/estado {estado_hacia, motivo}` y `PATCH /pedidos/mis-pedidos/{id}/cancelar` (el contrato `{nuevo_estado}` y `DELETE` propio son de C-11, DT-17). Los roles que acceden a cada endpoint no cambian: la matriz RBAC no se toca.
- **Sin migración ni variables nuevas**: `usuario_id` del historial ya es nullable, `EN_CAMINO` ya está en el catálogo (C-07) y el append-only se garantiza en la aplicación (ver OQ-5 para la alternativa con trigger).

**Fuera de alcance (con dueño):**

- Descuento de stock al confirmar, no descontar al crear, devolución solo desde CONFIRMADO+, «pago aprobado sin stock»: **C-10** (C-09 deja el hook vacío; el stock se sigue descontando al crear y restaurando en toda cancelación, como hoy).
- Firma del webhook, idempotencia real, consistencia transaccional pago/pedido y reintentos: **C-05** (el webhook sigue tragando la excepción de la FSM como hoy).
- Contrato `{nuevo_estado}`, `GET /pedidos/{id}` e historial para el propietario, `DELETE` como cancelación, `HTTPException` fuera de los services: **C-11 / C-25a**.
- `COCINA`, KDS, WebSocket (eventos nuevos, `roles[0]` en `/cocina/ws`): **C-26 / C-27** (DD-23, PA-07 abierta en esa parte).
- Reembolso de un pedido `MERCADOPAGO` cancelado con pago aprobado: **PA-08** (abierta).

**Governance: ALTO.** El change se detiene en estos artefactos; el usuario revisa la propuesta y responde (o acepta por defecto) OQ-1..OQ-7 de `design.md` antes de apply.

## Capabilities

### New Capabilities
- `order-lifecycle`: ciclo de vida del pedido en el backend: los 6 estados y sus transiciones válidas por actor (roles y Sistema), la confirmación según la forma de pago, el punto único de entrada a `CONFIRMADO`, la cancelación con motivo, los estados terminales y el historial append-only ordenado de cada transición.

### Modified Capabilities
- `rbac-authorization`: el requisito «Transiciones de pedido con todos los roles del usuario» decía que el conjunto de transiciones de cada rol no cambiaba en esa capacidad. Ahora la unión de roles también rige la regla de confirmación por forma de pago y remite a `order-lifecycle` para el contenido de la tabla.

## Impact

- **Código**: `backend/app/modules/pedidos/` (módulo puro nuevo `fsm.py` con la tabla, el actor y las reglas; `service.py`: un único método de transición, hook de confirmación, método público de confirmación automática, `ESTADOS` con `en_camino`); `backend/app/modules/historiales_estado_pedido/repository.py` (sin `update`/`delete`, orden con desempate); `backend/app/modules/pagos/service.py` (el webhook llama a la confirmación automática). El router de pedidos no cambia.
- **API**: sin endpoints nuevos ni cambios de body. Cambia el comportamiento: `EN_PREP → EN_CAMINO → ENTREGADO` pasa a funcionar, `EN_PREP → ENTREGADO` pasa a 409 y confirmar a mano un `MERCADOPAGO` pasa a 409. No hay frontend todavía (C-13+).
- **Datos**: los pedidos existentes en `EN_PREP` deben pasar por `EN_CAMINO` para entregarse. Los pedidos `TARJETA` heredados (forma deshabilitada en C-07) no se pueden confirmar: solo cancelar (OQ-7).
- **Tests**: unit de la tabla FSM pura; integración por HTTP de cada transición válida e inválida por rol y forma de pago, historial, cancelación y webhook aprobado (con `_consultar_pago_mp` reemplazado, borde externo). Los tests existentes deberían seguir verdes (todos los pedidos de prueba son `EFECTIVO`).
- **Documentación**: `knowledge-base/05` (tabla RN-PE sin columna de deuda para DT-03/DT-15), `07` (Flujos 5 y 6), `09` (DT-03, DT-15 resueltas; DT-13 resuelta en su parte de actor; DD-11 con la regla por forma de pago), `10` (IN-03, IN-20, IN-21) y `CHANGES.md` (puntos de partida de C-09 en C-05, C-10 y C-11).
