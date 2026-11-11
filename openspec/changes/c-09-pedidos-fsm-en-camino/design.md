# Design — C-09 `pedidos-fsm-en-camino`

## Context

- Motivación y alcance: ver `proposal.md` (Why / What Changes). Requisitos: `specs/order-lifecycle/spec.md` y `specs/rbac-authorization/spec.md`.
- Estado del código relevante (relevado el 2026-11-11 sobre `dev`, después de C-08):
  - `backend/app/modules/pedidos/service.py`: `PedidoService.TRANSICIONES` (dict de clase, ADMIN/PEDIDOS/CLIENT, 5 estados, `EN_PREP → {ENTREGADO, CANCELADO}`). La validación está en `_validar_transicion(estado_actual_codigo, estado_destino_codigo, estado_actual_es_terminal, motivo, roles)`, que usa `union_por_roles` (`core/permissions.py`). Hay **dos** métodos que cambian estado y repiten la secuencia «validar → actualizar → restaurar stock si cancela → historial»: `cambiar_estado_pedido` (async, emite WebSocket) y `cancelar_pedido_propio`. `crear_pedido` escribe la primera fila del historial (`estado_desde=None`) y descuenta stock (deuda DT-04, C-10). `ESTADOS` no tiene `en_camino`. Los services lanzan `HTTPException` (deuda, C-11/C-25a).
  - `backend/app/modules/pedidos/router.py`: `PATCH /{id}/estado` con `require_role(["ADMIN", "PEDIDOS", "COCINA"])` y `PATCH /mis-pedidos/{id}/cancelar` con `require_role(["CLIENT"])`, ambos pasan `roles` de `get_current_roles`. `get_pedido_service(session)` arma `PedidoService(PedidoUnitOfWork(session))`.
  - `backend/app/modules/pagos/service.py::procesar_webhook`: con `approved`, dentro de un `PagoUnitOfWork`, arma `PedidoService(PedidoUnitOfWork(uow._session))` y llama `await cambiar_estado_pedido(..., PedidoCambioEstado("CONFIRMADO", motivo=...), usuario_id=<dueño del pedido>, roles=frozenset({"ADMIN"}))`. Toda excepción se registra y se traga (el pago queda `aprobado` aunque el pedido no avance: IN-22, C-05).
  - `backend/app/modules/historiales_estado_pedido/`: modelo con `usuario_id` **nullable** (FK a `usuario`), sin `updated_at`. El repositorio hereda `update`/`delete` de `BaseRepository` y ordena por `created_at ASC` sin desempate. `created_at` lo completa Python (`utc_now()`), no la base.
  - Catálogo (C-07): `EN_CAMINO`(4), `ENTREGADO`(5, terminal), `CANCELADO`(6, terminal); formas `MERCADOPAGO`, `EFECTIVO`, `TRANSFERENCIA` (`TARJETA` queda deshabilitada en bases viejas). No hay rol `SISTEMA` en el catálogo de roles.
  - Tests: `test_pedidos.py` y `test_pedidos_multirol.py` usan pedidos `EFECTIVO`; ninguno usa `EN_PREP → ENTREGADO`. `test_pago.py` no cubre el camino `approved` del webhook. La matriz RBAC (`tests/support/rbac_matriz.py`) no cambia: C-09 no toca qué roles entran a cada endpoint.

## Goals / Non-Goals

**Goals:**
- Una **sola** definición declarativa de la FSM (tabla por actor + regla por forma de pago), pura y testeable sin base.
- Un **único método** que aplica cualquier transición (manual, cancelación propia, automática) y un único paso de confirmación inyectable, que es el gancho de C-10.
- Que el actor quede explícito (usuario con roles o Sistema) en lugar de prestar el rol `ADMIN`.
- Historial append-only garantizado por la aplicación, con orden total.

**Non-Goals:**
- Cambiar el contrato HTTP (`estado_hacia`, `/mis-pedidos`, `DELETE`): C-11.
- Mover `HTTPException` fuera del service o formalizar errores de dominio: C-11/C-25a. C-09 sigue el patrón actual.
- Cambiar el comportamiento de stock (descontar al crear, restaurar en toda cancelación): C-10. C-09 conserva lo que hay, ahora dentro del método único.
- Consistencia pago/pedido del webhook, firma e idempotencia: C-05.
- Eventos WebSocket nuevos, KDS, `COCINA`: C-26/C-27.

## Cambio de modelo (explícito)

| | Código actual | Spec / decisión | Modelo adoptado |
|---|---|---|---|
| **Estados con transiciones** | 5 (sin `EN_CAMINO`), `EN_PREP → ENTREGADO` | 6 (`[INT]` §3.4) | 6; `EN_PREP → EN_CAMINO → ENTREGADO`; sin atajo |
| **Confirmación manual** | ADMIN/PEDIDOS, cualquier forma de pago | Solo `EFECTIVO`/`TRANSFERENCIA`, ADMIN/PEDIDOS (DD-22) | Regla por forma de pago evaluada con la unión de roles |
| **Confirmación automática** | Webhook con `roles={ADMIN}` y `usuario_id` del cliente | Actor Sistema, `usuario_id` NULL (DT-13) | Actor Sistema, solo `MERCADOPAGO` (OQ-1, OQ-2) |
| **Cancelación en `EN_PREP`** | ADMIN y PEDIDOS | `[INT]`: ADMIN/PEDIDOS; `[DESC]`: solo ADMIN | ADMIN y PEDIDOS (OQ-3) |
| **Cancelación en `EN_CAMINO`** | (estado inexistente) | Sin flecha en `[INT]` | No se cancela |
| **Historial** | Hereda `update`/`delete`; orden `created_at` | Append-only (`[INT]` RN-03) | Repo sin `update`/`delete`; orden `created_at, id` (OQ-5) |

## Decisions

### D1. Módulo puro `pedidos/fsm.py` con la tabla y el actor
- Se crea `backend/app/modules/pedidos/fsm.py`, sin imports de SQLModel, FastAPI ni repositorios (solo `app.core.permissions`). Contiene:
  - `TRANSICIONES: Mapping[str, Mapping[str, frozenset[str]]]` por actor: `ADMIN` y `PEDIDOS` con las filas de la tabla de `proposal.md`; `CLIENT` con `PENDIENTE`/`CONFIRMADO → CANCELADO`; `SISTEMA` con `PENDIENTE → CONFIRMADO`.
  - `CONFIRMAN_POR_FORMA_PAGO: Mapping[str, frozenset[str]]` = `{"EFECTIVO": {ADMIN, PEDIDOS}, "TRANSFERENCIA": {ADMIN, PEDIDOS}, "MERCADOPAGO": {SISTEMA}}`. Una forma ausente (`TARJETA`) no la confirma nadie (OQ-7).
  - `Actor` (dataclass congelada: `usuario_id: int | None`, `roles: frozenset[str]`) con dos constructores: `Actor.usuario(usuario_id, roles)` (descarta un eventual `SISTEMA` que llegara de la base) y `ACTOR_SISTEMA = Actor(None, {SISTEMA})`.
  - Funciones puras: `destinos_permitidos(actor, estado_actual, forma_pago) -> frozenset[str]` (unión por roles con `union_por_roles`, y quita `CONFIRMADO` si ningún rol del actor está en `CONFIRMAN_POR_FORMA_PAGO[forma_pago]`) y `motivo_rechazo_confirmacion(actor, forma_pago) -> str | None` para el 409 específico de `MERCADOPAGO` (OQ-4).
- **Por qué**: DD-11 ya eligió una tabla declarativa; la regla por forma de pago es otra tabla del mismo estilo, no un `if` disperso. Al ser pura, la matriz completa (actor × estado × forma de pago) se prueba en unit sin base. `PedidoService.TRANSICIONES` deja de existir (nadie fuera del service lo usa: verificado con `grep`).
- **Alternativas**: (a) mantener la tabla en el service y agregar un `if forma_pago` en `_validar_transicion`: mezcla reglas y es lo que DD-11 quería evitar. (b) `SISTEMA` como flag booleano separado de los roles: obliga a ramificar en cada consulta; como pseudo-rol reutiliza `union_por_roles` sin cambios. El riesgo de que un usuario real tenga `SISTEMA` se cubre en `Actor.usuario` y no existe en el catálogo.

### D2. Un único método de transición y paso de confirmación inyectable
- `PedidoService._transicionar(uow, pedido, destino, actor, motivo) -> None` es el **único** lugar que: verifica terminal (409 «No se puede cambiar un pedido en estado terminal»), consulta `destinos_permitidos` (409 «No se puede cambiar de X a Y», o el mensaje de OQ-4), exige motivo para `CANCELADO` (400, defensa en profundidad; el body ya da 422), actualiza `estado_codigo`, ejecuta el paso de confirmación si el destino es `CONFIRMADO`, conserva la restauración de stock actual si el destino es `CANCELADO` (C-10 la reemplaza) y escribe **una** fila de historial con `actor.usuario_id`.
- `cambiar_estado_pedido`, `cancelar_pedido_propio` y el nuevo `confirmar_por_pago_aprobado` solo resuelven el pedido y el actor, y delegan. Se elimina la duplicación actual entre los dos primeros. Las firmas públicas existentes no cambian (siguen recibiendo `usuario_id` y `roles`), así que el router no se toca.
- **Paso de confirmación**: `PedidoService.__init__(uow, *, al_confirmar: PasoConfirmacion = sin_efecto)`, donde `PasoConfirmacion = Callable[[PedidoUnitOfWork, Pedido], None]`. Se ejecuta dentro del `with uow` de la transición, antes de escribir el historial: si lanza, el UoW hace rollback y no queda ni el estado nuevo ni la fila. En C-09 es un no-op; C-10 inyecta `StockService.descontar`.
- **Fábrica única**: `construir_pedido_service(session) -> PedidoService` en `pedidos/service.py`. La usan `get_pedido_service` (router) y `pagos/service.py`, para que C-10 conecte el paso en un solo lugar y webhook y router compartan la configuración.
- **Por qué inyectable y no un método a sobrescribir**: es un seam público (constructor) que el test usa vía `app.dependency_overrides[get_pedido_service]` para probar el escenario «Falla en el paso de confirmación» sin parchear internals (regla TDD: no mockear colaboradores internos).
- **Alternativas**: (a) llamar directamente a un `StockService` desde `_transicionar`: adelanta C-10. (b) eventos de dominio/observer: sobredimensionado para un único consumidor.

### D3. Confirmación automática: `confirmar_por_pago_aprobado` con actor Sistema (OQ-1, OQ-2)
- Nuevo método público síncrono `PedidoService.confirmar_por_pago_aprobado(pedido_id) -> PedidoReadFull`: aplica `_transicionar(..., CONFIRMADO, ACTOR_SISTEMA, motivo="Pago aprobado por MercadoPago")`. Como `SISTEMA` solo confirma `MERCADOPAGO` (D1), un pedido de otra forma de pago o fuera de `PENDIENTE` recibe el 409 de la FSM.
- `pagos/service.py`: reemplaza el `await cambiar_estado_pedido(... roles={ADMIN}, usuario_id=<dueño>)` por `construir_pedido_service(uow._session).confirmar_por_pago_aprobado(pago.pedido_id)`. Deja de leer `pedido.usuario_id` para el log. Conserva la respuesta `{"status": "processed", "pago_id", "pedido_actualizado"}` (el router de pagos la usa para el WebSocket) y el `try/except` que traga el error de la FSM (consistencia: C-05). El webhook sigue respondiendo 200.
- **Por qué en C-09 y no en C-05**: con la regla «un `MERCADOPAGO` no se confirma a mano», el webhook con `roles={ADMIN}` quedaría rechazado por la FSM y ningún pago aprobado confirmaría un pedido. El actor Sistema es parte de la FSM. C-05 conserva DT-06, DT-20, DT-21 y la consistencia transaccional; DT-13 queda resuelta por C-09 (se anota en `CHANGES.md`).

### D4. Cancelación
- Cliente (`/mis-pedidos/{id}/cancelar`): sigue exigiendo `CLIENT` y propiedad (403); el actor es `Actor.usuario(usuario_id, roles)` con todos sus roles (C-08, OQ-7 de C-08 confirmada: un `CLIENT + ADMIN` puede cancelar su pedido en `EN_PREP`). Con solo `CLIENT`, `PENDIENTE` y `CONFIRMADO`.
- Gestión (`/estado`): ADMIN y PEDIDOS en `PENDIENTE`, `CONFIRMADO`, `EN_PREP` (OQ-3). `EN_CAMINO` sin cancelación.
- Motivo: `PedidoCambioEstado.validar_motivo_cancelacion` ya da 422 sin motivo. Se mantiene la verificación del service (400) como defensa para el camino del Sistema (C-10 cancelará «sin stock»).

### D5. Historial append-only (OQ-5)
- `HistorialEstadoPedidoRepository` sobrescribe `update` y `delete` para lanzar `HistorialInmutableError` (excepción propia del módulo, no `HTTPException`: nunca debería llegar a un request). Solo quedan `add` y las lecturas.
- `get_all_by_pedido_id` ordena por `created_at ASC, id ASC`. `created_at` lo genera Python en cada `add`, así que dos transiciones en pedidos sucesivos no empatan, pero dos filas en la misma transacción podrían: el `id` (serial) da el orden de inserción.
- **Sin migración**: no se agrega trigger. La garantía en la base (trigger `BEFORE UPDATE OR DELETE`) queda como alternativa en OQ-5: chocaría con el `ON DELETE CASCADE` desde `pedidos` (que hoy usan `reset`/tests) y exigiría la migración `003`.

### D6. Detalles menores
- `ESTADOS` suma `"en_camino": "EN_CAMINO"` (y `"despachado"`, `"shipped"` como alias, igual que el resto). Las constantes de la FSM usan los códigos del catálogo.
- `EVENTOS_WS` no cambia: `EN_CAMINO` y `ENTREGADO` salen como `ESTADO_ACTUALIZADO` (OQ-6, WebSocket es Fase 2).
- El log de auditoría muestra `actor` (`Sistema` o `usuario <id> roles [...]`).
- `obtener_pedidos_cocina` no cambia (filtra `CONFIRMADO`/`EN_PREP`).

### D7. Capas y reglas duras
- `fsm.py` es dominio puro dentro del módulo `pedidos`; el service depende de él; el router no cambia y no suma `Session` ni lógica. `pagos/service.py` ya dependía de `pedidos/service.py` (sin dependencias nuevas entre módulos).
- DRY: `_transicionar` reemplaza las dos secuencias duplicadas. SOLID: la regla por forma de pago es datos (abierto a una forma nueva sin tocar el código).
- Type hints en todas las funciones públicas nuevas; `Mapping`/`frozenset` inmutables para las tablas.

### D8. Sin migración ni variables nuevas
`EN_CAMINO` ya está en el catálogo (C-07), `historial_estado_pedido.usuario_id` ya es nullable (migración 001) y el append-only es de aplicación (D5). La cabeza de Alembic sigue en `002`.

### D9. Tests (Strict TDD en apply)
- **Unit** (`tests/unit/test_pedido_fsm.py`, sin base): tabla completa con literales escritos a mano (nunca recalculados desde `TRANSICIONES`): cada estado × {ADMIN, PEDIDOS, CLIENT, COCINA, STOCK, SISTEMA} × forma de pago; multi-rol; `Actor.usuario` descarta `SISTEMA`; mensaje de OQ-4.
- **Integración** (`tests/integration/test_pedidos_fsm.py`, PostgreSQL real): por HTTP, cada escenario de `specs/order-lifecycle`, con asserts sobre el estado y el historial releídos de la base. Helpers locales para crear un pedido en un estado y forma de pago dados (como `_pedido` de `test_pedidos_multirol.py`) e identidades con `crear_usuario_con_roles`/`bearer_de_usuario` (C-08). Recorrido completo creando el pedido por `POST /pedidos/`.
- **Webhook** (`tests/integration/test_pago_webhook_fsm.py`): `mercadopago.SDK` reemplazado **en el sitio de uso** (`app.modules.pagos.service.mercadopago.SDK`) por un doble que devuelve `approved` y el `external_reference` del pedido (borde externo). Un `Pago` `pendiente` creado en la sesión de test.
- **Paso de confirmación**: `app.dependency_overrides[get_pedido_service]` con `PedidoService(uow, al_confirmar=<función que lanza>)`.
- **Append-only**: el repositorio por su interfaz pública (`update`/`delete` lanzan y la fila releída no cambia); orden con dos filas de igual `created_at` insertadas directamente.
- **Existentes**: no deberían romperse (pedidos `EFECTIVO`, confirmación por ADMIN). Si alguno falla, es regresión: frenar y analizar, sin relajar asserts.

### D10. Documentación
`knowledge-base/05` (tabla RN-PE sin columna de deuda para DT-03/DT-15; RN-PE-02, RN-PE-11 y RN-PE-14 según OQ-3), `07` (Flujo 5 paso 5 con actor Sistema; Flujo 6 sin deuda DT-03), `09` (DT-03 y DT-15 resueltas por C-09; DT-13 resuelta en la parte de actor; DD-11 con la regla por forma de pago y el pseudo-actor Sistema), `10` (IN-03, IN-20, IN-21 cerradas) y `CHANGES.md` (puntos de partida de C-09 en [C-05], [C-10] y [C-11]).

## UI Mockups

- Design system revision: N/A
- Decision: no (no UI) — 2026-11-11
- Mockups: N/A

## Risks / Trade-offs

- [Pedidos reales en `EN_PREP` no se pueden entregar sin pasar por `EN_CAMINO`] → Es la regla de la spec. No hay producción; en desarrollo, un paso más por pedido.
- [El webhook sigue tragando el 409 de la FSM: un pago aprobado sobre un pedido no `MERCADOPAGO` o ya cancelado queda `aprobado` con el pedido sin confirmar] → Es la inconsistencia IN-22 que ya existe; la resuelve C-05 (y el reembolso, PA-08). C-09 solo la hace visible en el log.
- [`SISTEMA` como pseudo-rol en la tabla podría confundirse con un rol real] → No existe en el catálogo de roles; `Actor.usuario` lo descarta; test unit lo fija.
- [Append-only solo en la aplicación: un SQL manual puede modificar el historial] → Aceptable para el TPI; la alternativa con trigger está en OQ-5.
- [El paso de confirmación corre en el mismo `with uow` que la transición; si C-10 abre su propio UoW, rompe la atomicidad] → La firma `PasoConfirmacion(uow, pedido)` recibe el UoW abierto; se anota en `CHANGES.md` [C-10].
- [Tests de pedidos crean pedidos en estados arbitrarios directamente en la base] → Es el patrón existente (`test_pedidos_multirol.py`); el recorrido completo por HTTP cubre el camino real.

## Migration Plan

1. Sin migración de esquema ni variables nuevas.
2. Comportamiento: `EN_PREP → ENTREGADO` pasa a 409 (usar `EN_CAMINO`); confirmar a mano un `MERCADOPAGO` pasa a 409; el historial de la confirmación automática pasa a `usuario_id` NULL (las filas viejas no se reescriben: es append-only).
3. Rollback: revertir el código. No hay datos que migrar.

## Open Questions

Decisiones del usuario con el valor por defecto que aplican specs y tasks (si cambian, se ajustan con `/opsx:update` antes de apply):

- **OQ-1 — Actor Sistema en C-09 o en C-05** (solapamiento de alcance): `CHANGES.md` asigna el actor Sistema (DT-13) a C-05, pero C-09 lo necesita (D3). **Por defecto: C-09 implementa el actor Sistema y `usuario_id` NULL en la confirmación automática**; C-05 conserva firma, idempotencia y consistencia. Alternativa: C-09 deja el webhook con un rol especial temporal y C-05 hace el actor. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-2 — Alcance del Sistema**: **por defecto el Sistema solo confirma pedidos `MERCADOPAGO` en `PENDIENTE`**; un pago aprobado sobre otra forma de pago no cambia el pedido (webhook 200). Alternativa: el Sistema confirma cualquier forma de pago con pago aprobado. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-3 — Cancelación en `EN_PREP`** (contradicción `[INT]` ↔ `[DESC]`): `[INT]` §3.4 dice «→ CANCELADO (solo ADMIN/PEDIDOS)»; `[DESC]` dice solo ADMIN; el scope de C-09 en `CHANGES.md` dice «cancelación solo en PENDIENTE/CONFIRMADO», que coincide con el cliente (RN-PE-10). **Por defecto: `[INT]` (ADMIN y PEDIDOS cancelan en `EN_PREP`; el cliente solo en `PENDIENTE`/`CONFIRMADO`; nadie en `EN_CAMINO`)**. Alternativas: solo ADMIN en `EN_PREP`, o nadie cancela desde `EN_PREP`. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-4 — Respuesta a la confirmación manual de un `MERCADOPAGO`**: **por defecto 409 con `detail` «Un pedido MERCADOPAGO se confirma con el pago aprobado»** (distinto del genérico «No se puede cambiar de X a Y»). Alternativa: el 409 genérico, o 403. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-5 — Garantía del append-only**: **por defecto en la aplicación** (el repositorio no permite `update`/`delete`), sin migración. Alternativa: trigger PostgreSQL en una migración `003` (bloquea UPDATE; DELETE solo por cascada), con más costo de tests y de `reset`. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-6 — Eventos WebSocket de `EN_CAMINO`/`ENTREGADO`**: **por defecto sin eventos nuevos** (`ESTADO_ACTUALIZADO`); el WebSocket es Fase 2 (C-27). Alternativa: agregar `PEDIDO_EN_CAMINO` y `PEDIDO_ENTREGADO` ya. **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**
- **OQ-7 — Pedidos `TARJETA` heredados**: **por defecto no se confirman** (ni a mano ni por webhook); solo se cancelan. Alternativa: tratarlos como `EFECTIVO`/`TRANSFERENCIA` (confirmación manual). **Respuesta: confirmado el valor por defecto (aprobado 2026-11-11, by user).**

Discrepancias de documentación detectadas (se corrigen en el grupo de docs, sin decisión pendiente salvo OQ-3):
- `knowledge-base/05` RN-PE-11 dice «en spec EN_PREP→CANCELADO es solo ADMIN `[DESC]`» y la tabla RN-PE dice «solo ADMIN `[DESC]` / ADMIN-PEDIDOS `[INT]`»: se alinea a la respuesta de OQ-3.
- `knowledge-base/05` RN-PE-07 dice «400» para la cancelación sin motivo; el código responde 422 (validador del body) antes de llegar al service. Se documenta 422.
- `CHANGES.md` [C-05] incluye DT-13 (actor Sistema): según OQ-1 pasa a C-09.
- El seed describe el rol `PEDIDOS` como «Avanza estados CONFIRMADO->ENTREGADO»; con DD-22 también confirma `EFECTIVO`/`TRANSFERENCIA`. Es texto descriptivo del seed: no se cambia en C-09 (cambiarlo reconcilia datos sin necesidad).

## Desvíos registrados en apply (2026-11-11)

- `fsm.py` importa también `types.MappingProxyType` (tablas inmutables), además de `app.core.permissions`, `collections.abc`, `dataclasses`: no hay imports de capas superiores.
- `pedidos/router.py` cambia una línea (`get_pedido_service` usa `construir_pedido_service`; D2/4.2 lo exige): no suma Session ni lógica. `git diff --stat` del router no es vacío por ese motivo.
- Tests de rechazo y de `TARJETA`: `TARJETA` no está en el seed, así que el helper de test inserta la `FormaPago` deshabilitada.
- Inconsistencia previa que sigue (IN-22/C-05): si la FSM rechaza la confirmación automática, el `rollback` del UoW de pedidos deshace también el cambio pendiente del `Pago` en la misma sesión; el pago puede quedar `pendiente` en vez de `aprobado`. Lo resuelve C-05.
- 6.1 (ADMIN no cancela `EN_CAMINO`) pasó directo (sin RED): la tabla nueva ya no tiene esa flecha y antes el estado no existía en `TRANSICIONES`.
