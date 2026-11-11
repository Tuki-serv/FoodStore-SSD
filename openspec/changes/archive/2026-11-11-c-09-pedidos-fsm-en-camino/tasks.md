# Tasks — C-09 `pedidos-fsm-en-camino`

> **Governance ALTO**: no se empieza ninguna tarea hasta que el usuario apruebe `proposal.md`, `design.md`, `specs/` y este archivo, y responda (o acepte por defecto) OQ-1..OQ-7 de `design.md`. Si una respuesta cambia el valor por defecto, primero se ajustan los artefactos con `/opsx:update`.
> Strict TDD: cada comportamiento sigue RED → GREEN → TRIANGULATE → REFACTOR, y los tests se **ejecutan** en cada gate. Skills: `python-testing-patterns`, `tdd`: AAA, nombres `test_<unidad>_<escenario>_<esperado>`, fixtures en `conftest.py`, literales independientes (los estados y destinos esperados se escriben a mano, nunca se recalculan desde `TRANSICIONES`), probar por la interfaz pública (HTTP, función pública o constructor), mocks solo en bordes externos (SDK de MercadoPago en el sitio de uso), un test → una implementación, sin aserciones triviales.
> Hard rules: tests sobre PostgreSQL real (`foodstore_test`; prerrequisito `docker compose up -d db` desde la raíz, puerto 5433; si no está, frenar y reportarlo). Comandos desde `backend/`. No levantar servidores ni construir imágenes (regla 13). No commitear ni pushear. **El agente no lee ni escribe archivos `.env*`** (sin variables nuevas: design D8). Sin migraciones (D8): si alguna tarea parece necesitar una, frenar y consultar.
> Referencias: decisiones D1..D10 de `design.md`; requisitos en `specs/order-lifecycle` y `specs/rbac-authorization`. Helpers de identidad de C-08: `crear_usuario_con_roles`, `bearer_de_usuario`, `bearer_con_roles` (`tests/support/auth_helpers.py`); el rol `COCINA` lo siembra la fixture.

## 0. Red de seguridad

- [x] 0.1 Correr `pytest` completo desde `backend/` antes de tocar nada y registrar el resultado (total, passed, failed, tiempo). Verificar: 0 failed. Si algo falla, frenar y reportarlo como falla preexistente, sin corregirla.
- [x] 0.2 Registrar en `design.md` §Open Questions la respuesta del usuario a OQ-1..OQ-7 («confirmado: por defecto» o el valor elegido, con fecha). Verificar con `grep -n "OQ-[1-7]" openspec/changes/c-09-pedidos-fsm-en-camino/design.md` que cada línea tiene la respuesta.

## 1. Tabla FSM pura (D1)

- [x] 1.1 RED: nuevo `backend/tests/unit/test_pedido_fsm.py` (sin base). `destinos_permitidos(Actor.usuario(1, frozenset({"PEDIDOS"})), "EN_PREP", "EFECTIVO")` es `frozenset({"EN_CAMINO", "CANCELADO"})`; con `"EN_CAMINO"` es `frozenset({"ENTREGADO"})`. Ejecutar → falla porque `app.modules.pedidos.fsm` no existe.
- [x] 1.2 GREEN: crear `backend/app/modules/pedidos/fsm.py` con `TRANSICIONES` (ADMIN, PEDIDOS, CLIENT, SISTEMA), `Actor`, `ACTOR_SISTEMA` y `destinos_permitidos` usando `union_por_roles`; sin imports de SQLModel, FastAPI ni repositorios. Ejecutar → verde.
- [x] 1.3 TRIANGULATE (secuencia y terminales): ADMIN en `EN_PREP` no incluye `ENTREGADO`; en `CONFIRMADO` es `{EN_PREP, CANCELADO}`; en `EN_CAMINO` no incluye `CANCELADO` ni `EN_PREP`; en `ENTREGADO` y `CANCELADO` es vacío para todos los actores; `CLIENT` en `PENDIENTE`/`CONFIRMADO` es `{CANCELADO}` y en `EN_PREP` vacío; `COCINA` y `STOCK` vacío en todo estado; `STOCK+PEDIDOS` en `EN_CAMINO` es `{ENTREGADO}`; `CLIENT+ADMIN` en `EN_PREP` incluye `CANCELADO`. Ejecutar → verde.
- [x] 1.4 RED (forma de pago): ADMIN en `PENDIENTE` con `"EFECTIVO"` y con `"TRANSFERENCIA"` incluye `CONFIRMADO`; con `"MERCADOPAGO"` es `{CANCELADO}`; con `"TARJETA"` es `{CANCELADO}`; `ACTOR_SISTEMA` en `PENDIENTE` con `"MERCADOPAGO"` es `{CONFIRMADO}` y con `"EFECTIVO"` es vacío; `CLIENT+PEDIDOS` con `"EFECTIVO"` incluye `CONFIRMADO`. Ejecutar → falla (todavía no hay regla por forma de pago).
- [x] 1.5 GREEN: agregar `CONFIRMAN_POR_FORMA_PAGO` y aplicarlo en `destinos_permitidos` (quita `CONFIRMADO` si ningún rol del actor confirma esa forma). Ejecutar → verde.
- [x] 1.6 TRIANGULATE (actor y mensaje): `Actor.usuario(5, frozenset({"SISTEMA", "CLIENT"}))` tiene `roles == frozenset({"CLIENT"})` y en `PENDIENTE` con `"MERCADOPAGO"` no incluye `CONFIRMADO`; `ACTOR_SISTEMA.usuario_id is None`; `motivo_rechazo_confirmacion` para ADMIN y `"MERCADOPAGO"` devuelve «Un pedido MERCADOPAGO se confirma con el pago aprobado» (OQ-4) y para ADMIN y `"EFECTIVO"` devuelve `None`. Ejecutar → verde.
- [x] 1.7 REFACTOR: tablas como `Mapping`/`frozenset` inmutables, constantes de estados y roles con nombre, type hints y docstring del módulo que remite a `specs/order-lifecycle`. Ejecutar `pytest tests/unit/test_pedido_fsm.py tests/unit/test_permissions.py` → verde.

## 2. Transición única en el service y despacho `EN_CAMINO` (D2, D6)

- [x] 2.1 RED: nuevo `backend/tests/integration/test_pedidos_fsm.py` con helpers locales `_pedido(session, usuario_id, estado, forma_pago)` y `_historial(session, pedido_id)`. Usuario `PEDIDOS` pasa a `EN_CAMINO` un pedido `EN_PREP` → 200, `estado_codigo` `EN_CAMINO`, estado releído `EN_CAMINO` y una fila nueva `EN_PREP→EN_CAMINO` con su `usuario_id`. Ejecutar → falla (409 hoy).
- [x] 2.2 GREEN: `PedidoService` usa `fsm.destinos_permitidos` en un único `_transicionar(uow, pedido, destino, actor, motivo)` (terminal → 409, destino no permitido → 409, motivo para `CANCELADO` → 400, actualizar estado, restauración de stock actual si cancela, una fila de historial con `actor.usuario_id`). `cambiar_estado_pedido` y `cancelar_pedido_propio` construyen `Actor.usuario(usuario_id, roles)` y delegan; se elimina `PedidoService.TRANSICIONES` y `_validar_transicion`. `ESTADOS` suma `en_camino`. Firmas públicas y router sin cambios. Ejecutar `pytest tests/integration/test_pedidos_fsm.py tests/integration/test_pedidos.py tests/integration/test_pedidos_multirol.py` → verde.
- [x] 2.3 TRIANGULATE (secuencia): ADMIN `EN_CAMINO → ENTREGADO` → 200; ADMIN `EN_PREP → ENTREGADO` → 409 y sigue `EN_PREP`; PEDIDOS `CONFIRMADO → EN_CAMINO` → 409; ADMIN `EN_CAMINO → EN_PREP` → 409; destino `DESPACHADO` → 400; `ENTREGADO → CANCELADO` con motivo → 409; `CANCELADO → CONFIRMADO` → 409; `STOCK+PEDIDOS` `EN_CAMINO → ENTREGADO` → 200; `COCINA` `EN_PREP → EN_CAMINO` → 409; `CLIENT` en `/estado` → 403. En cada rechazo, la cantidad de filas del historial no cambia. Ejecutar → verde.
- [x] 2.4 REFACTOR: el log de auditoría muestra el actor (D6); sin código duplicado entre `cambiar_estado_pedido` y `cancelar_pedido_propio` (verificar con lectura del diff que la secuencia validar/actualizar/historial existe una sola vez). Ejecutar `pytest tests/integration/test_pedidos_fsm.py tests/integration/test_pedidos.py tests/integration/test_pedidos_multirol.py tests/integration/test_estadisticas.py` → verde.
- [x] 2.5 Docs: `knowledge-base/05` tabla RN-PE (fila `EN_PREP → EN_CAMINO`, fila `EN_CAMINO → ENTREGADO`, sin la columna de deuda de DT-03) y RN-PE-14; `knowledge-base/07` Flujo 6 paso 5 sin la nota DT-03. Verificar con `grep -n "EN_CAMINO" knowledge-base/05_reglas_de_negocio.md knowledge-base/07_flujos_principales.md`.

## 3. Confirmación manual por forma de pago (D1, D2, OQ-4, OQ-7)

- [x] 3.1 RED: en `test_pedidos_fsm.py`, ADMIN pide `CONFIRMADO` sobre un `MERCADOPAGO` en `PENDIENTE` → 409 con `detail` «Un pedido MERCADOPAGO se confirma con el pago aprobado», sigue `PENDIENTE` y el historial no suma filas. Ejecutar → falla (hoy 200).
- [x] 3.2 GREEN: `_transicionar` usa `motivo_rechazo_confirmacion` para el `detail` del 409 cuando el destino es `CONFIRMADO` y la forma de pago lo impide. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: PEDIDOS confirma `EFECTIVO` → 200; ADMIN confirma `TRANSFERENCIA` → 200; ADMIN sobre `TARJETA` → 409 y sigue `PENDIENTE`; `COCINA` sobre `EFECTIVO` → 409; `CLIENT+PEDIDOS` sobre `EFECTIVO` → 200; `PEDIDOS+ADMIN` sobre `MERCADOPAGO` → 409. Ejecutar → verde.
- [x] 3.4 Docs: `knowledge-base/05` RN-PE-02 sin «Deuda DT-15»; `knowledge-base/09` DT-15 resuelta por C-09 y DD-11 con la regla por forma de pago; `knowledge-base/10` IN-20 cerrada. Verificar con `grep -n "DT-15\|IN-20" knowledge-base/05_reglas_de_negocio.md knowledge-base/09_decisiones_y_supuestos.md knowledge-base/10_preguntas_abiertas.md`.

## 4. Punto único de entrada a CONFIRMADO (D2)

- [x] 4.1 RED: en `test_pedidos_fsm.py`, override de `get_pedido_service` con `PedidoService(PedidoUnitOfWork(session), al_confirmar=<función que lanza RuntimeError>)`: ADMIN confirma un `EFECTIVO` en `PENDIENTE` → la respuesta no es 200, el pedido releído sigue `PENDIENTE` y no hay fila hacia `CONFIRMADO`. Ejecutar → falla (el parámetro `al_confirmar` no existe).
- [x] 4.2 GREEN: `PedidoService.__init__(uow, *, al_confirmar: PasoConfirmacion = sin_efecto)`; `_transicionar` lo invoca dentro del `with uow` cuando el destino es `CONFIRMADO`, antes del historial. Fábrica `construir_pedido_service(session)`; `get_pedido_service` la usa. Ejecutar → verde. Limpiar `dependency_overrides` en un `finally`/fixture.
- [x] 4.3 TRIANGULATE: con un paso que registra las llamadas, una confirmación manual lo invoca una vez con el pedido correcto; pasar a `EN_PREP` o a `CANCELADO` no lo invoca. Ejecutar → verde.
- [x] 4.4 Docs: `CHANGES.md` [C-10]: punto de partida (C-09): `al_confirmar(uow, pedido)` en `construir_pedido_service`, mismo UoW de la transición; la restauración de stock al cancelar sigue en `_transicionar`. Verificar con `grep -n "Punto de partida (C-09)" CHANGES.md`.

## 5. Confirmación automática como Sistema (D3, OQ-1, OQ-2)

- [x] 5.1 RED: nuevo `backend/tests/integration/test_pago_webhook_fsm.py`. Pedido `MERCADOPAGO` en `PENDIENTE` con un `Pago` `pendiente`; `app.modules.pagos.service.mercadopago.SDK` reemplazado por un doble cuyo `payment().get` devuelve `status` 200, `approved` y el `external_reference` del pedido. `POST /api/v1/pagos/webhook` con `{"type": "payment", "data": {"id": "123"}}` → 200, pedido releído `CONFIRMADO` y la última fila del historial `PENDIENTE→CONFIRMADO` con `usuario_id` `None`. Ejecutar → falla (hoy el actor es el cliente; con la regla de 3.2 el pedido ni siquiera se confirma).
- [x] 5.2 GREEN: `PedidoService.confirmar_por_pago_aprobado(pedido_id)` con `ACTOR_SISTEMA`; `pagos/service.py` usa `construir_pedido_service(uow._session).confirmar_por_pago_aprobado(pago.pedido_id)`, conserva `{"status": "processed", "pago_id", "pedido_actualizado"}` y el `try/except` actual. Ejecutar `pytest tests/integration/test_pago_webhook_fsm.py tests/integration/test_pago.py` → verde.
- [x] 5.3 TRIANGULATE: pago aprobado de un pedido `EFECTIVO` en `PENDIENTE` → 200 y sigue `PENDIENTE` sin filas nuevas; de un `MERCADOPAGO` en `CANCELADO` → 200 y sigue `CANCELADO`; comparación con una confirmación manual de un `EFECTIVO`: ambas suman exactamente una fila `PENDIENTE→CONFIRMADO` y solo difiere `usuario_id`. Ejecutar → verde.
- [x] 5.4 REFACTOR: `pagos/service.py` ya no importa `PedidoCambioEstado` ni lee `pedido.usuario_id` para el actor; `grep -rn "frozenset({\"ADMIN\"})" backend/app` vacío. Ejecutar `pytest tests/integration/test_pago_webhook_fsm.py tests/integration/test_pago.py tests/integration/test_pedidos_fsm.py` → verde.
- [x] 5.5 Docs: `knowledge-base/07` Flujo 5 paso 5 (actor Sistema, solo `MERCADOPAGO`); `knowledge-base/09` DT-13 resuelta por C-09 en la parte de actor; `knowledge-base/10` IN-21 cerrada; `CHANGES.md` [C-05]: punto de partida (C-09) (el actor Sistema ya está; quedan firma, idempotencia y consistencia; el webhook sigue tragando el 409 de la FSM). Verificar con `grep -n "DT-13\|IN-21" knowledge-base/09_decisiones_y_supuestos.md knowledge-base/10_preguntas_abiertas.md`.

## 6. Cancelación (D4, OQ-3)

> La tabla de cancelación ya quedó fijada en unit (1.3). Este grupo agrega los tests de aceptación HTTP de `specs/order-lifecycle` «Cancelación con motivo en estados permitidos». Se espera que pasen al escribirlos; si alguno falla, ese es el RED y se corrige en `fsm.py` o `_transicionar` (no se relajan asserts).

- [x] 6.1 Aceptación: en `test_pedidos_fsm.py`, ADMIN cancela con motivo un pedido `EN_CAMINO` → 409, sigue `EN_CAMINO` y el historial no suma filas. Ejecutar y registrar si pasó directo o fue RED.
- [x] 6.2 Si 6.1 o 6.3 fallan: corregir la tabla o `_transicionar` y re-ejecutar → verde. Si no, marcar «sin cambios de código».
- [x] 6.3 Aceptación: dueño `CLIENT` cancela su `CONFIRMADO` con motivo «me arrepentí» → 200; solo `CLIENT` en `EN_PREP` → 409; `PEDIDOS` cancela `EN_PREP` con motivo «sin insumos» → 200 y la última fila tiene ese motivo y su `usuario_id`; ADMIN cancela `PENDIENTE` sin motivo → 422 y sigue `PENDIENTE`; ADMIN cancela `CONFIRMADO` con «cliente no responde» → la fila registra motivo y actor. Ejecutar → verde.
- [x] 6.4 Docs: `knowledge-base/05` RN-PE-07 (422 por validación del body), RN-PE-10 y RN-PE-11 según OQ-3 (y la fila `EN_PREP` de la tabla sin «solo ADMIN `[DESC]`»). Verificar con `grep -n "RN-PE-07\|RN-PE-11" knowledge-base/05_reglas_de_negocio.md`.

## 7. Historial append-only y ordenado (D5, OQ-5)

- [x] 7.1 RED: nuevo `backend/tests/integration/test_historial_append_only.py`. Con una fila de historial existente, `HistorialEstadoPedidoRepository(session).update(fila)` y `.delete(fila)` lanzan `HistorialInmutableError`, y la fila releída sigue con el mismo `estado_hacia` y `motivo`. Ejecutar → falla (hoy los heredados funcionan).
- [x] 7.2 GREEN: `HistorialInmutableError` en el módulo de historial; el repositorio sobrescribe `update` y `delete` para lanzarla. Ejecutar → verde.
- [x] 7.3 RED: en un pedido sin historial, insertar desde la sesión de test dos filas con el **mismo** `created_at` y `id` explícitos, primero la de `id` mayor (`estado_hacia` `CONFIRMADO`) y después la de `id` menor (`estado_hacia` `PENDIENTE`), para que el orden físico difiera del orden por `id` → `GET /api/v1/pedidos/{id}/historial` como ADMIN las devuelve por `id` ascendente (`PENDIENTE` primero). Ejecutar → falla (sin desempate PostgreSQL devuelve el orden físico). Si pasara por azar, registrarlo y seguir sin inventar un rojo.
- [x] 7.4 GREEN: `get_all_by_pedido_id` ordena por `created_at ASC, id ASC`. Ejecutar → verde.
- [x] 7.5 TRIANGULATE (recorrido completo): un `CLIENT` crea un pedido `EFECTIVO` por `POST /api/v1/pedidos/`; un `PEDIDOS` lo confirma y lo pasa a `EN_PREP`, `EN_CAMINO` y `ENTREGADO`; `GET /historial` devuelve 5 filas: la primera de `None` a `PENDIENTE` con el `usuario_id` del cliente, luego los cuatro pares con el `usuario_id` del `PEDIDOS`, y cada `estado_desde` igual al `estado_hacia` anterior. Ejecutar → verde.
- [x] 7.6 Docs: `knowledge-base/05` RN-PE-05 (garantía de aplicación, OQ-5) y `knowledge-base/04` §HistorialEstadoPedido (orden `created_at, id`). Verificar con `grep -n "append-only" knowledge-base/04_modelo_de_datos.md knowledge-base/05_reglas_de_negocio.md`.

## 8. Cierre e integración

- [x] 8.1 Correr la suite completa desde `backend/` → baseline de 0.1 + los nuevos, 0 failed (incluida `test_rbac_matriz.py`, que no debe cambiar). Registrar total y tiempo en el resumen de apply.
- [x] 8.2 Revisión de reglas duras (1–6): `grep -n "import" backend/app/modules/pedidos/fsm.py` solo muestra `app.core.permissions`, `collections.abc`, `dataclasses` y `typing`; `git diff --stat backend/app/modules/pedidos/router.py` vacío; `grep -rn "TRANSICIONES" backend/app` solo en `fsm.py` y `service.py`; type hints en todas las funciones públicas nuevas; cabeza de Alembic sigue en `002` (`ls backend/alembic/versions`). Anotar en `design.md` cualquier desvío con su motivo.
- [x] 8.3 Consistencia documental: `knowledge-base/09` marca DT-03 y DT-15 resueltas por C-09 (y DT-13 en su parte de actor); `knowledge-base/10` cierra IN-03, IN-20 e IN-21; `CHANGES.md` tiene «Punto de partida (C-09)» en [C-05], [C-10] y [C-11] (este último: contrato `{nuevo_estado}` y `DELETE` propio deben delegar en los mismos métodos del service). Verificar con `grep -n "DT-03\|DT-15" knowledge-base/09_decisiones_y_supuestos.md` y `grep -n "Punto de partida (C-09)" CHANGES.md`.

## Workflow follow-up

- Verificar el change (`openspec-verify`) contra specs, design y tasks.
- Archivar con `/opsx:archive` y marcar `[x]` C-09 en `CHANGES.md`.
