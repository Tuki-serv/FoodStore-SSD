# Tasks — C-22 `fe-gestion-operativa-pedidos`

> **Governance MEDIO**: implementar por bloques con checkpoints; las decisiones no obvias se reportan al usuario. **Gate**: no se escribe código (bloque 1 en adelante) hasta que los mockups del bloque 0 estén aprobados (`design.md` §UI Mockups con `Approval: approved`) y las respuestas a OQ-1..OQ-8 estén registradas. Si una respuesta difiere del defecto (p. ej. OQ-2/OQ-3 = sin backend, OQ-4 = soft delete, OQ-7 = ampliar filtros), se ajustan specs, mockups y estas tareas antes del bloque 1.
> **Criterios de aceptación visual**: los HTML de `mockups/` de este change (listado, detalle y diálogos) una vez aprobados.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Backend: pytest contra PostgreSQL `foodstore_test` (`backend/tests/.env.test`), AAA, nombres `test_<unidad>_<escenario>_<resultado>`. Frontend: red simulada solo con MSW (`onUnhandledRequest: 'error'`), nunca `vi.mock` de módulos propios; consultas por rol/nombre accesible, `userEvent.setup()` con `await`; `QueryClient` nuevo por test con `retry: false`; valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: capas backend `models ← repository ← uow ← services ← routers` (sin Session ni lógica en routers); sin cambios de esquema (si aparecieran, migración Alembic); FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; pedidos = server state (TanStack Query), Zustand solo para UI; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build`, `uvicorn` ni servidores (regla 13); no commitear. No se toca nada de `COCINA` (PA-07). Comandos de frontend desde `frontend/`, de backend desde `backend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con las pantallas y estados de la tabla de `design.md` §UI Mockups (p. ej. `gestion-pedidos.html?estado=…`, `gestion-pedido-detalle.html?estado=…&forma=…`, `dialogos.html?dialogo=…&error=…`, `?rol=pedidos|admin|client`), `mockup.css`/`mockup.js` reutilizados de C-19/C-20b, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 Mostrar los mockups y OQ-1..OQ-8 al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md` y la respuesta (o «por defecto») de cada OQ en `design.md`. Verificación: ambos archivos con la aprobación y las OQ resueltas. **Sin esto no se inicia el bloque 1.**

## 1. Red de seguridad

- [x] 1.1 Backend: `pytest tests/integration/test_pedidos_contrato.py tests/integration/test_pedidos_fsm.py tests/integration/test_historial_append_only.py tests/integration/test_pedidos_multirol.py` (rutas reales según `ls tests/integration tests/unit`); anotar la línea base. Si algo falla, frenar y reportarlo como falla previa.
- [x] 1.2 Frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base (archivos/tests verdes). Si algo falla, frenar y reportarlo.

## 2. Backend: dirección en el detalle (spec `order-api`, design D10, OQ-2)

- [x] 2.1 RED: test de integración — un `PEDIDOS` pide `GET /api/v1/pedidos/{id}` de un pedido de otro cliente con dirección «Casa» y recibe `direccion.alias` «Casa», `linea1` y `ciudad` literales. Ejecutar → falla.
- [x] 2.2 GREEN: `DireccionPedidoRead` y `PedidoDetalle.direccion` en `schemas.py`; repositorio de direcciones en `PedidoUnitOfWork`; `_armar_detalle` la completa (sin pasar por `DireccionService`). Ejecutar → verde.
- [x] 2.3 TRIANGULATE: retiro (`direccion_id` nulo) → `direccion` nulo; el dueño también la recibe; dirección soft-deleted después de crear el pedido → sigue visible; `POST /pedidos/` y `PATCH /estado` devuelven el detalle con `direccion` (mismo armado). Ejecutar → verde; tests existentes de pedidos/pagos verdes.

## 3. Backend: autor en el historial (spec `order-api`, design D10, OQ-3)

- [x] 3.1 RED: un gestor «Carla» confirma un pedido `EFECTIVO`; `GET /pedidos/{id}/historial` devuelve en la fila `PENDIENTE→CONFIRMADO` `usuario_nombre` «Carla». Ejecutar → falla.
- [x] 3.2 GREEN: `HistorialEstadoPedidoRead.usuario_nombre`; consulta del historial con `LEFT JOIN usuario` en un solo query (orden `created_at, id`); `obtener_historial` la usa. Ejecutar → verde.
- [x] 3.3 TRIANGULATE: fila inicial con el nombre del cliente; confirmación por pago aprobado (Sistema) → `usuario_id` y `usuario_nombre` nulos; orden intacto con varios eventos; el repositorio sigue rechazando `update`/`delete`. Ejecutar → verde. REFACTOR + suite backend completa de pedidos verde; revisión de capas (sin lógica en el router).

## 4. Entidad `pedido`: modelo puro (spec `frontend-order-management`)

- [x] 4.1 RED → GREEN + TRIANGULATE `accionesGestion(estado, formaPago)` y `proximoAvance` (design D3) en `entities/pedido/model/transiciones.ts`: tabla completa 6 estados × 3 formas (p. ej. `PENDIENTE`+`EFECTIVO` → «Confirmar pago», «Cancelar pedido»; `PENDIENTE`+`MERCADOPAGO` → solo «Cancelar pedido»; `EN_CAMINO` → solo «Marcar entregado»; `ENTREGADO`/`CANCELADO` → `[]`; código desconocido → `[]`). Comentario con la fuente `backend/app/modules/pedidos/fsm.py`. Ejecutar → verde.
- [x] 4.2 RED → GREEN + TRIANGULATE `clasificarErrorCambioEstado` (design D8): 409 `INSUFFICIENT_STOCK` → `sin-stock`; 409 `INVALID_TRANSITION` → `transicion`; 422 `field: motivo` → `motivo`; 403; 404; `status: null` y 500 → `conexion`; 400 desconocido → `otro`. Ejecutar → verde.
- [x] 4.3 RED → GREEN + TRIANGULATE autor/título de un evento de historial (design D4): `estado_desde` nulo → «Pedido creado»; `usuario_nombre` «Carla» → «Carla»; `usuario_id` nulo → «Sistema»; sin nombre con id → «Usuario #7». Ejecutar → verde.
- [x] 4.4 Tipos `PedidoResumen`, `EventoHistorial`, `DireccionPedido`, `FiltrosListadoPedidos`, `EstadoPedidoCodigo`; `PedidoDetalle.direccion`. Verificación: `npm run typecheck` verde (C-19/C-20 siguen compilando).

## 5. Entidad `pedido`: API, queries y línea de tiempo

- [x] 5.1 Ampliar `src/test/msw/pedidos.ts` (design D11): estado en memoria de pedidos e historial; `GET /pedidos/` con filtros `estado`/`desde`/`hasta` y paginación aplicados al estado; `GET /pedidos/:id/historial`; `PATCH /pedidos/:id/estado` que aplica la tabla de la FSM y registra cuerpos; respuestas forzables (409 stock/transición, 403, 404, 422, 500, red, demora) y contador de pedidos por ruta. Verificación: tests existentes de checkout/pago siguen verdes y lo usan 5.2–5.3.
- [x] 5.2 RED → GREEN + TRIANGULATE `listarPedidos`/`pedidoQueries.lista(filtros)` (params sin claves vacías: `{estado:'EN_PREP',page:2}` → `?estado=EN_PREP&page=2&size=20`), `obtenerHistorial`/`pedidoQueries.historial(id)`. Ejecutar → verde.
- [x] 5.3 RED → GREEN + TRIANGULATE `LineaTiempoHistorial` (`entities/pedido/ui`): `<ol>` en orden del servidor con título, autor, fecha/hora local y motivo; cancelación con su estilo; «Pedido creado» sin repetir el motivo inicial. axe sin violaciones. Ejecutar → verde.
- [x] 5.4 REFACTOR: `entities/pedido/index.ts` exporta lo nuevo; `obtenerPedido` documenta acceso de dueño y gestores; suite, typecheck y lint verdes.

## 6. Rutas y acceso

- [x] 6.1 RED: `src/app/router/__tests__/rutas-gestion-pedidos.test.tsx`: `PEDIDOS` y `ADMIN` en `/gestion-pedidos` ven «Gestión de pedidos» (ya no la provisoria); `CLIENT` en `/gestion-pedidos/57` → «Sin permiso» sin `GET /pedidos/57` en MSW; anónimo → `/ingresar` con la ruta recordada. Ejecutar → falla.
- [x] 6.2 GREEN: `RUTA_GESTION_PEDIDO`/`rutaGestionPedido` en `shared/config/routes.ts`; rutas en `app/router/routes.tsx` con `RequiereAcceso` (design D1); ajustar `route-map` y su test si verifican provisorias. Ejecutar → verde.

## 7. Listado, filtros y actualización (spec `frontend-order-management`)

- [x] 7.1 RED → GREEN + TRIANGULATE `pages/gestion-pedidos/model/filtro.ts`: `leerFiltrosPedidos` (`?estado=PENDIENTE&desde=2026-11-18&page=2`; estado desconocido → «Todos»; fecha inválida → vacía; page < 1 → 1), `aParametros` (defectos sin rastro), `validarRango` (`2026-11-19` > `2026-11-18` → error). Ejecutar → verde.
- [x] 7.2 RED: `pages/gestion-pedidos/__tests__/gestion-pedidos.test.tsx` con `renderApp('/gestion-pedidos', { sesion: { roles: ['PEDIDOS'] } })`: «#58» «Ana» «Efectivo» «$ 3.850» «Pendiente» antes que «#57» «Bruno»; pulsar «#58» → `/gestion-pedidos/58`. Ejecutar → falla.
- [x] 7.3 GREEN: `GestionPedidosPage`, `TablaPedidos`/`FilaPedido`, CSS e import en `app/styles/index.css` (lo verifica `styles-compile`). Ejecutar → verde.
- [x] 7.4 TRIANGULATE filtros y paginación: elegir «En preparación» → URL `estado=EN_PREP` y solo esos; fechas → servidor recibe `desde`/`hasta`; rango invertido → mensaje y ningún pedido nuevo en MSW; abrir con `?estado=PENDIENTE` → filtro precargado; 45 pedidos, página 3 → 5 filas y `page=3`; cambiar filtro vuelve a página 1; «Limpiar filtros». Ejecutar → verde.
- [x] 7.5 TRIANGULATE estados: carga inicial; «Todavía no hay pedidos»; «No hay pedidos con estos filtros» + «Limpiar filtros»; 500 → error + «Reintentar» que vuelve a pedir. Ejecutar → verde.
- [x] 7.6 RED → GREEN + TRIANGULATE actualización (design D6, fake timers): a los 30 s se vuelve a pedir y aparece un pedido agregado al estado de MSW; con `document.visibilityState = 'hidden'` no hay pedidos periódicos; «Actualizar» pide en el momento y cambia «Actualizado a las HH:MM»; error en una actualización con datos previos → aviso discreto sin perder la tabla. Ejecutar → verde.
- [x] 7.7 axe sin violaciones en el listado con datos y con el error de rango. Ejecutar → verde.

## 8. Detalle e historial

- [x] 8.1 RED: `pages/gestion-pedidos/__tests__/gestion-pedido-detalle.test.tsx`: `/gestion-pedidos/58` muestra «Pedido #58», «Ana», «Efectivo», «Av. Siempre Viva 742, Springfield», ítems con «Sin cebolla», total «$ 3.850», nota del cliente y la línea de tiempo con «Pedido creado». Ejecutar → falla.
- [x] 8.2 GREEN: `GestionPedidoDetallePage`, `TarjetaEntrega`, `AccionesPedido` (solo render), CSS (design D9). Ejecutar → verde.
- [x] 8.3 TRIANGULATE: retiro → «Retiro en el local»; historial con evento del «Sistema» y con observación; 404 → «No encontramos este pedido» + «Volver a pedidos» (conserva los filtros de la URL de origen); historial con 500 → el detalle se ve y el bloque de historial muestra «Reintentar»; polling de detalle e historial a los 30 s. Ejecutar → verde.
- [x] 8.4 RED → GREEN + TRIANGULATE **botones por estado × forma de pago × rol** en el detalle (spec «Acciones según estado, rol y forma de pago»): los seis estados con `EFECTIVO`, `TRANSFERENCIA` y `MERCADOPAGO` (aviso «Se confirma solo cuando Mercado Pago aprueba el pago»), con sesión `ADMIN` y con `PEDIDOS` (mismas acciones), y `CLIENT`+`PEDIDOS` igual a `PEDIDOS`. Ejecutar → verde.
- [x] 8.5 axe sin violaciones en el detalle con historial. Ejecutar → verde.

## 9. Feature `cambiar-estado-pedido`: avanzar y confirmar pago

- [x] 9.1 RED: en el detalle del pedido 57 `CONFIRMADO`, «Pasar a preparación» abre el diálogo «Pasar a preparación el pedido #57» con «Confirmado → En preparación»; escribir «Sale en 20 min» y confirmar → MSW recibe `{"nuevo_estado":"EN_PREP","motivo":"Sale en 20 min"}`; el detalle muestra «En preparación», ofrece «Despachar», el historial suma el evento con la observación y aparece el toast «Pedido #57 en preparación». Ejecutar → falla.
- [x] 9.2 GREEN: `features/cambiar-estado-pedido/` (`DialogoCambioEstado` con TanStack Form, `useCambiarEstadoPedido` que siembra el detalle e invalida `['pedidos']`, `index.ts`) (design D2, D7). Ejecutar → verde.
- [x] 9.3 TRIANGULATE: «Despachar» sin observación → cuerpo sin `motivo` y el diálogo muestra la entrega; «Marcar entregado» → «Entregado» sin acciones; observación > 300 bloqueada con contador; con demora, «Guardando…» deshabilitado, Escape no cierra y doble clic → un solo `PATCH`; Escape en reposo cierra y el foco vuelve a «Despachar». Ejecutar → verde.
- [x] 9.4 RED → GREEN + TRIANGULATE confirmar pago (DD-22, DD-20): pedido 58 `PENDIENTE` `EFECTIVO` → diálogo con el texto de confirmación manual y descuento de stock → `{"nuevo_estado":"CONFIRMADO"}` → «Confirmado» con «Pasar a preparación»; `TRANSFERENCIA` igual; 409 `INSUFFICIENT_STOCK` «No hay stock suficiente para Hamburguesa Clásica» → alerta con ese texto, pedido sigue «Pendiente», «Cancelar por falta de stock» abre la cancelación con «Sin stock». Ejecutar → verde.
- [x] 9.5 TRIANGULATE errores (design D8): 409 `INVALID_TRANSITION` → `detail` + «El pedido cambió mientras lo mirabas» y el detalle se vuelve a pedir y muestra el estado real; red → «No pudimos conectar con el servidor.» + «Reintentar» que reenvía el mismo cuerpo (2 `PATCH` iguales) con la observación intacta; 500 → «Reintentar»; 403 y 404 con sus textos. Ejecutar → verde.
- [x] 9.6 RED → GREEN + TRIANGULATE próxima acción en el listado (spec «Próxima acción desde el listado»): fila `PENDIENTE` `TRANSFERENCIA` → «Confirmar pago» que abre el mismo diálogo y, al terminar, la fila muestra «Confirmado» y «Pasar a preparación»; filas `PENDIENTE` `MERCADOPAGO`, `ENTREGADO` y `CANCELADO` sin acción; ninguna fila ofrece cancelar. Ejecutar → verde.

## 10. Feature `cambiar-estado-pedido`: cancelar

- [x] 10.1 RED: en el pedido 58 `PENDIENTE`, «Cancelar pedido» abre «Cancelar el pedido #58» con «La cancelación no se puede deshacer.»; motivo «El cliente no responde» → MSW recibe `{"nuevo_estado":"CANCELADO","motivo":"El cliente no responde"}`; el pedido muestra «Cancelado» sin acciones y el historial suma el evento con el motivo. Ejecutar → falla.
- [x] 10.2 GREEN: `DialogoCancelarPedido` sobre `DialogoBaja` (design D7). Ejecutar → verde.
- [x] 10.3 TRIANGULATE: motivo vacío o solo espacios → «Escribí el motivo de la cancelación», foco al campo, ningún `PATCH`; motivo con espacios al borde se envía recortado; `CONFIRMADO`/`EN_PREP` → aviso de stock devuelto; `CONFIRMADO` `MERCADOPAGO` → aviso de reintegro (R5); `EN_CAMINO` sin «Cancelar pedido»; 422 `field: motivo` → error en el campo. Ejecutar → verde.
- [x] 10.4 axe sin violaciones en los diálogos de avance, confirmar pago con error de stock y cancelación con error. Ejecutar → verde.

## 11. Cierre

- [x] 11.1 Backend: suite de pedidos/pagos/estadísticas verde contra la línea base del 1.1. Frontend: `npm test`, `npm run typecheck`, `npm run lint` verdes; `tests/architecture` (`fsd-boundaries`, `styles-compile`, `tailwind-tokens`) verdes; anotar totales contra el 1.2. **Resultado (2026-11-19): backend 1759 passed; frontend 146 archivos, 1462 tests (+ cuerpo.test.ts), typecheck y lint limpios.**
- [x] 11.2 Revisión SOLID/DRY del diff (una sola tabla de acciones; un clasificador de errores; `Dialogo`/`DialogoBaja`/`Paginacion`/`BadgeEstado`/`EtiquetaFormaPago`/formateo de precio reutilizados; sin lógica en routers ni Session fuera del repositorio). Verificación: nota en este archivo con lo revisado.
- [x] 11.3 Docs: `knowledge-base/06_funcionalidades.md` (US-020..US-022 marcadas; polling en vez de WebSocket), `knowledge-base/05_reglas_de_negocio.md` (RN-PE-12 según OQ-4), `knowledge-base/04_modelo_de_datos.md` o `08` si se documenta el contrato (`direccion`, `usuario_nombre`), `frontend/README.md` (gestión de pedidos), `CHANGES.md` (cierre de C-22; «Punto de partida (C-22)» en C-21: `pedidoQueries.lista/historial`, `LineaTiempoHistorial`, `transiciones.ts`; en C-24; en C-25b: R1, R2, R6 y OQ-7). Verificación: archivos actualizados.

> **Revisión SOLID/DRY (11.2).** Una sola tabla de acciones (`accionesGestion`, usada por el detalle y por `proximoAvance` de la fila); un solo clasificador (`clasificarErrorCambioEstado`) para ambos diálogos; un solo hook de envío (`useEnvioCambio`) y un solo `PieDialogo`/`AlertaCambio`/`CampoTexto` compartidos por el avance y la cancelación; `CambioEstadoPedido` es el único punto que elige diálogo, aviso y destino, y lo usan el listado y el detalle. Reutilizados: `Dialogo`, `DialogoBaja` (extendido con `children`), `Campo`, `Paginacion`, `BadgeEstado`, `EtiquetaFormaPago`, `formatearPrecio`, `claseBoton`. Backend: sin lógica en routers ni `Session` fuera del repositorio; `service → uow → repository`; el historial sigue append-only. Pendiente conocido, no tocado: la FSM de la UI es copia de `fsm.py` (R1 del design).

## Workflow follow-up

- Verify visual (design.md §UI Mockups paso 12): backend real + Vite con permiso del usuario, comparar listado, detalle y diálogos con los mockups a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-22-fe-gestion-operativa-pedidos` y marcar `[x]` en `CHANGES.md`.
