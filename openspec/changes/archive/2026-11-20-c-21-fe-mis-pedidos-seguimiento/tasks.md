# Tasks — C-21 `fe-mis-pedidos-seguimiento`

> **Governance MEDIO**: implementar por bloques con checkpoints; las decisiones no obvias se reportan al usuario. **Gate**: no se escribe código (bloque 1 en adelante) hasta que los mockups del bloque 0 estén aprobados (`design.md` §UI Mockups con `Approval: approved`) y las respuestas a OQ-1..OQ-6 estén registradas (registradas el 2026-11-19: todas por defecto salvo **OQ-4 = filtro por estado**, ya reflejado en specs, design D4/D11, estas tareas y los mockups del listado).
> **Criterios de aceptación visual**: los HTML de `mockups/` de este change (listado, detalle y diálogo de cancelación) una vez aprobados.
> **Strict TDD** (skills `tdd`, `python-testing-patterns`, `vitest`, `react-testing`, `tanstack-query`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Backend: pytest contra PostgreSQL `foodstore_test` (`backend/tests/.env.test`), AAA, nombres `test_<unidad>_<escenario>_<resultado>`. Frontend: red simulada solo con MSW (`onUnhandledRequest: 'error'`), nunca `vi.mock` de módulos propios; consultas por rol/nombre accesible, `userEvent.setup()` con `await`; `QueryClient` nuevo por test con `retry: false`; valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: capas backend `models ← repository ← uow ← services ← routers` (sin Session ni lógica en routers); sin cambios de esquema; FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones, nada de importar entre páginas o entre features); TS `strict` sin `any`; pedidos y pagos = server state (TanStack Query), Zustand solo para UI; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build`, `uvicorn` ni servidores (regla 13); no commitear. No se toca nada de `COCINA` (PA-07). Comandos de frontend desde `frontend/`, de backend desde `backend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con las pantallas y estados de la tabla de `design.md` §UI Mockups (`mis-pedidos.html?estado=…`, `mi-pedido-detalle.html?estado=…&forma=…`, `dialogos.html?dialogo=…&error=…`), `mockup.css`/`mockup.js` reutilizados de C-22, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada estado a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 Registrar las respuestas a OQ-1..OQ-6 en `design.md` (resolución del 2026-11-19: defecto salvo OQ-4 → filtro por estado) y revisar specs, design y tareas en consecuencia. Verificación: `design.md` §Open Questions con la resolución; `openspec validate --strict` verde.
- [x] 0.4 Revisar el mockup del listado con el filtro por estado (`mis-pedidos.html`: filtro en todos los estados, `?estado=filtro` «Entregado» con paginación y «Limpiar filtro», `?estado=filtro-vacio` «No tenés pedidos en ese estado») y re-renderizar solo las capturas `mis-pedidos-*` a 1440x900 y 390x844. Verificación: capturas nuevas en `previews/`, `Preview:` actualizado en `design.md` y `mockups/README.md`.
- [x] 0.5 Mostrar los mockups revisados al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`. Verificación: ambos archivos con la aprobación. **Sin esto no se inicia el bloque 1.**

## 1. Red de seguridad

- [x] 1.1 Backend: `pytest tests/integration/test_pedidos_contrato.py tests/integration/test_pedidos_multirol.py tests/integration/test_pedidos_gestion.py tests/integration/test_pedidos_fsm.py tests/integration/test_pedidos_stock.py`; anotar la línea base. Si algo falla, frenar y reportarlo como falla previa.
- [x] 1.2 Frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base. Si algo falla, frenar y reportarlo.

## 2. Backend: filtro `propios` (spec `order-api`, design D2, OQ-1)

- [x] 2.1 RED: test de integración — un usuario con roles `CLIENT` y `PEDIDOS` con 2 pedidos propios y 3 de otro cliente llama a `GET /api/v1/pedidos?propios=true` y recibe `total` 2, solo pedidos suyos. Ejecutar → falla.
- [x] 2.2 GREEN: `FiltrosPedidos.propios: bool = False` (`filtros.py`) y `listar_pedidos` limita el alcance al usuario si `propios` (`service.py`). Ejecutar → verde.
- [x] 2.3 TRIANGULATE: el mismo usuario sin el filtro sigue viendo 5 (regresión «Unión de CLIENT y PEDIDOS»); `CLIENT` con `propios=true` = sin filtro; `CLIENT`+`ADMIN` con `propios=true&estado=PENDIENTE` → `total` 1 (cubre el filtro de estado de «Mis pedidos»: el alcance propio y `estado` se combinan; si ya pasa sin cambios en el repositorio, queda como test de contrato); `propios=quizas` → 422 `field` `propios`. REFACTOR + suite de pedidos verde; sin lógica en el router.

## 3. Movimientos sin cambio de comportamiento (design D1, D7)

- [x] 3.1 Mover `MarcaActualizacion`/`AvisoActualizacionFallida` a `shared/ui/marca-actualizacion` (exportados por `shared/ui/index.ts`) e `INTERVALO_ACTUALIZACION_MS` a `shared/config`; `gestion-pedidos` los importa de ahí. Verificación: tests de `gestion-pedidos` verdes sin modificarlos; `fsd-boundaries` verde.
- [x] 3.2 Mover `LineaEstadoPago`, `PagoEnConfirmacion`, `TraspasoPago` a `entities/payment/ui` (con sus reglas CSS de `pedido-creado.css` en `entities/payment/ui/pago.css`) (exportados por `entities/payment/index.ts`) y extraer `vistaPagoDelPedido(pedido, pago)` pura (qué mostrar: traspaso, reintento, en confirmación, nada) con RED → GREEN + TRIANGULATE (pendiente sin pago → traspaso; rechazado → reintento; pendiente → en confirmación; aprobado/a devolver o pedido no `PENDIENTE` → nada; no `MERCADOPAGO` → nada); `pedido-creado` la usa. Verificación: tests de `pedido-creado` y `pago-pedido` verdes sin modificarlos.
- [x] 3.3 Estado como filtro compartido (design D11): RED → GREEN + TRIANGULATE `esEstadoPedido` en `entities/pedido/model/estados.ts` (los seis códigos → sí; `DESPACHADO`, `''`, `null`, `pendiente` en minúscula → no) y `ESTADOS_PEDIDO` en el orden de la FSM; RED → GREEN `SelectorEstadoPedido` en `entities/pedido/ui` («Todos» + «Pendiente», «Confirmado», «En preparación», «En camino», «Entregado», «Cancelado»; elegir «Entregado» llama `onCambiar('ENTREGADO')`, «Todos» llama `onCambiar(null)`). `gestion-pedidos` (`model/filtro.ts`, `ui/filtros-pedidos.tsx`) pasa a usarlos y borra su copia (`ESTADOS_FILTRABLES`, `esEstado`). Verificación: tests de `gestion-pedidos` verdes sin modificarlos; `fsd-boundaries` verde.

## 4. Entidad `pedido`: modelo y API (spec `frontend-my-orders`)

- [x] 4.1 RED → GREEN + TRIANGULATE `puedeCancelarCliente(estado)` en `transiciones.ts` (`PENDIENTE`/`CONFIRMADO` → sí; `EN_PREP`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO`, desconocido → no), comentario con la fuente `fsm.py` `TRANSICIONES[CLIENT]`. Ejecutar → verde.
- [x] 4.2 RED → GREEN + TRIANGULATE `pasosProgreso(estado, conEnvio)` (design D6): `PENDIENTE` → paso 1 actual; `EN_PREP` → 1-2 cumplidos, 3 actual; `ENTREGADO` → todos cumplidos; `CANCELADO` → `null`; sin envío → paso 4 «Listo para retirar». Ejecutar → verde.
- [x] 4.3 RED → GREEN + TRIANGULATE `autorEventoCliente(evento, usuarioId)` (design D8): propio → «Vos»; `usuario_id` nulo → «Automático»; otro usuario con nombre «Carla» → «El local». Ejecutar → verde.
- [x] 4.4 RED → GREEN + TRIANGULATE API: `listarPedidos({ propios: true, page: 2, size: 10 })` → `?propios=true&page=2&size=10` (sin `propios` no viaja); `cancelarMiPedido(58, 'Me equivoqué')` → `DELETE /pedidos/58` con `{"motivo":"Me equivoqué"}` y devuelve el detalle. Ampliar `test/msw/pedidos.ts` (design D10): `DELETE` con FSM del cliente, dueño, cuerpos registrados y respuestas forzables; `GET /pedidos/` respeta `propios` y el `usuario_id` de la sesión simulada. Ejecutar → verde; tests de checkout/pago/gestión siguen verdes.
- [x] 4.5 RED → GREEN `LineaTiempoHistorial` acepta `autor` (por defecto `autorEvento`): con `autorEventoCliente` muestra «Vos»/«El local»/«Automático» y no «Carla»; gestión sin cambios. axe sin violaciones. REFACTOR: `index.ts` exporta lo nuevo; typecheck y lint verdes.

## 5. Rutas y acceso

- [x] 5.1 RED: `src/app/router/__tests__/rutas-mis-pedidos.test.tsx`: `CLIENT` en `/mis-pedidos` ve «Mis pedidos» (ya no la provisoria); anónimo en `/mis-pedidos/58` → `/ingresar` con la ruta recordada; `ADMIN` en `/admin/usuarios` sigue viendo la provisoria con dueño `C-23`. Ejecutar → falla.
- [x] 5.2 GREEN: `RUTA_MI_PEDIDO`/`rutaMiPedido` en `shared/config/routes.ts`; rutas en `app/router/routes.tsx`; ajustar `route-map` y los tests que usaban `/mis-pedidos` como ejemplo de provisoria (`shell-con-sesion`, `guards` si aplica). Ejecutar → verde.

## 6. Listado (spec «Listado de mis pedidos», «Filtro por estado de mis pedidos», «Estados de carga, vacío y error»)

- [x] 6.1 RED → GREEN + TRIANGULATE `pages/mis-pedidos/model`: `leerFiltroMisPedidos` (`?estado=ENTREGADO&page=3` → `{ estado: 'ENTREGADO', page: 3 }`; `estado=DESPACHADO` → `null`; `page` `abc`/`0`/ausente → 1), `aParametros` (`{ estado: null, page: 1 }` → `{}`; `{ estado: 'CANCELADO', page: 2 }` → `{ estado: 'CANCELADO', page: '2' }`) y `debeActualizarLista` (algún no terminado → sí; todos `ENTREGADO`/`CANCELADO` o vacío → no). Ejecutar → verde.
- [x] 6.2 RED: `pages/mis-pedidos/__tests__/mis-pedidos.test.tsx` con `renderApp('/mis-pedidos', { sesion: { roles: ['CLIENT'] } })`: «#58» «Efectivo» «$ 3.850» «Pendiente» antes que «#41» «Entregado»; MSW recibe `propios=true&page=1&size=10`; pulsar «#58» → `/mis-pedidos/58`. Ejecutar → falla.
- [x] 6.3 GREEN: `MisPedidosPage`, `ListaMisPedidos` (tabla/tarjetas), CSS e import en `app/styles/index.css` (lo verifica `styles-compile`). Ejecutar → verde.
- [x] 6.4 TRIANGULATE: 23 pedidos → página 3 con 3 filas y `page=3`; `CLIENT`+`PEDIDOS` solo ve los propios; carga inicial; vacío «Todavía no hiciste pedidos» + «Ver catálogo»; 500 → «Reintentar» que vuelve a pedir. Ejecutar → verde.
- [x] 6.5 RED → GREEN + TRIANGULATE actualización del listado (fake timers): con un pedido en curso a los 30 s se vuelve a pedir y cambia el estado mostrado; con todos terminados no se pide; pestaña oculta no pide; «Actualizar» pide en el momento. axe sin violaciones con datos. Ejecutar → verde.
- [x] 6.6 RED: filtro por estado (spec «Filtro por estado de mis pedidos»): elegir «Entregado» en «Estado» → URL con `estado=ENTREGADO`, MSW recibe `propios=true&estado=ENTREGADO&page=1&size=10` y solo se ven pedidos «Entregado»; «Limpiar filtro» visible. Ejecutar → falla.
- [x] 6.7 GREEN: `FiltroMisPedidos` (`Campo` «Estado» + `SelectorEstadoPedido` + «Limpiar filtro») en `MisPedidosPage`; cambiar el estado escribe `?estado=` con la página 1; MSW `GET /pedidos/` respeta `estado` junto con `propios`. Ejecutar → verde.
- [x] 6.8 TRIANGULATE: abrir `/mis-pedidos?estado=CANCELADO` → filtro «Cancelado» y `estado=CANCELADO` al servidor; `?estado=DESPACHADO` → «Todos» y sin `estado`; desde `?page=3` elegir «Pendiente» → URL sin `page`; 12 «Entregado» → página 2 con 2 filas y URL con `estado` y `page=2`; «Limpiar filtro» → `/mis-pedidos`, «Todos» y sin `estado`; en «Todos» no hay «Limpiar filtro»; con filtro sin resultados → «No tenés pedidos en ese estado» + «Limpiar filtro» y no «Todavía no hiciste pedidos» ni «Ver catálogo»; el filtro se ve en carga y error. axe sin violaciones con filtro activo. Ejecutar → verde.

## 7. Detalle, progreso, pago e historial

- [x] 7.1 RED: `pages/mis-pedidos/__tests__/mi-pedido-detalle.test.tsx`: `/mis-pedidos/58` muestra «Pedido #58», «Efectivo», «Av. Siempre Viva 742, Springfield», ítems con «Sin cebolla», total «$ 3.850», el progreso con «Paso actual: Pendiente» y «El local confirma tu pedido cuando recibe el pago.», y el historial con «Pedido creado» por «Vos». Ejecutar → falla.
- [x] 7.2 GREEN: `MiPedidoDetallePage`, `ProgresoPedido`, `AccionesMiPedido` (solo render), `PedidoNoEncontrado`, CSS (design D5, D6). Ejecutar → verde.
- [x] 7.3 TRIANGULATE: retiro → «Retiro en el local» y paso «Listo para retirar» en `EN_CAMINO`; `EN_PREP` → «Pendiente» y «Confirmado» cumplidos; `CANCELADO` → «Pedido cancelado» con el motivo y sin pasos; pedido de otro usuario → «No encontramos este pedido» sin datos; 404 y 403 → mismo texto con «Volver a mis pedidos»; 500 → error + «Reintentar»; historial con 500 → el detalle se ve y el historial ofrece «Reintentar»; evento sin usuario → «Automático»; evento del local → «El local». Ejecutar → verde.
- [x] 7.4 RED → GREEN + TRIANGULATE pago (design D7): `MERCADOPAGO` `PENDIENTE` con intento rechazado → «Último intento de pago: rechazado», motivo y «Reintentar el pago de $ 3.850» hacia `/finalizar-compra/pedido/58/pago`; sin intento → «Pagar $ 3.850 con tarjeta»; aprobado → «Pago aprobado» sin oferta; `EFECTIVO` → ningún pedido a `/pagos`. Ejecutar → verde.
- [x] 7.5 RED → GREEN + TRIANGULATE actualización del detalle (fake timers): `CONFIRMADO` → a los 30 s el MSW lo devuelve `EN_PREP` y se ve «En preparación» y el evento nuevo; `ENTREGADO` → no se vuelve a pedir; pestaña oculta → no pide; «Actualizar» cambia «Actualizado a las HH:MM». axe sin violaciones en el detalle con historial. Ejecutar → verde.

## 8. Cancelar mi pedido (spec «Cancelar mi pedido con motivo», «Errores al cancelar»)

- [x] 8.1 Red de seguridad de la feature: tests de `features/cambiar-estado-pedido` verdes antes de tocarla; anotar.
- [x] 8.2 RED: en el detalle del pedido 58 `PENDIENTE`, «Cancelar pedido» abre «Cancelar el pedido #58» con «La cancelación no se puede deshacer.»; motivo «Me equivoqué de dirección» → MSW recibe `DELETE /pedidos/58` con `{"motivo":"Me equivoqué de dirección"}`; el detalle muestra «Pedido cancelado» con el motivo, sin «Cancelar pedido», y el toast «Pedido #58 cancelado». Ejecutar → falla.
- [x] 8.3 GREEN: `useCancelarMiPedido` (política de caché compartida con `useCambiarEstadoPedido`), `useEnvioCambio` parametrizado por la mutación, `DialogoCancelarPedido` con `destinatario` (`'gestion'` por defecto), `CancelarMiPedido` exportado; `AccionesMiPedido` lo usa (design D3). Ejecutar → verde; tests de C-22 sin cambios y verdes.
- [x] 8.4 TRIANGULATE: motivo vacío o con espacios → «Escribí el motivo de la cancelación», foco al campo, ningún `DELETE`; motivo recortado; doble clic → un solo `DELETE`; `CONFIRMADO` `MERCADOPAGO` → aviso de reintegro; `CONFIRMADO` `EFECTIVO` → sin aviso de reintegro ni de stock; `EN_PREP`/`EN_CAMINO` → sin botón y con la explicación; Escape devuelve el foco a «Cancelar pedido». Ejecutar → verde.
- [x] 8.5 TRIANGULATE errores: 409 `INVALID_TRANSITION` → «Tu pedido ya avanzó y no se puede cancelar», el detalle se vuelve a pedir y muestra «En preparación»; red → «No pudimos conectar con el servidor.» + «Reintentar» que reenvía el mismo motivo (2 `DELETE` iguales); 500 → «Reintentar»; 403/404 → «Este pedido no está disponible». axe sin violaciones en el diálogo con error. Ejecutar → verde.

## 9. Cierre

- [x] 9.1 Backend: suite de pedidos/pagos verde contra la línea base del 1.1. Frontend: `npm test`, `npm run typecheck`, `npm run lint` verdes; `tests/architecture` (`fsd-boundaries`, `styles-compile`, `tailwind-tokens`) verdes; anotar totales contra el 1.2.
- [x] 9.2 Revisión SOLID/DRY del diff (un solo diálogo de cancelación para gestión y cliente; una sola política de caché de mutaciones de pedido; `vistaPagoDelPedido` única para confirmación y detalle; `SelectorEstadoPedido`/`esEstadoPedido` únicos para gestión y cliente; `MarcaActualizacion`, `LineaTiempoHistorial`, `EntregaDelPedido`, `BadgeEstado`, `Paginacion` reutilizados; sin lógica en routers). Verificación: nota en este archivo con lo revisado.
- [x] 9.3 Docs: `knowledge-base/06_funcionalidades.md` (US-018/US-019 marcadas; polling en vez de WebSocket), `knowledge-base/07_flujos_principales.md` Flujo 7 (motivo obligatorio en la UI, `propios`), `frontend/README.md` (Mis pedidos), `CHANGES.md` (cierre de C-21; nota en C-27: reemplaza el polling de `mis-pedidos`). Verificación: archivos actualizados.

## Nota 9.2 — revisión SOLID/DRY

Revisado: un solo diálogo de cancelación (`DialogoCancelarPedido` con `destinatario`), una política de caché de mutaciones (`politica-cache.ts`), `vistaPagoDelPedido` única para confirmación y detalle, `SelectorEstadoPedido`/`esEstadoPedido` únicos para gestión y cliente, y reutilización de `MarcaActualizacion`, `LineaTiempoHistorial`, `BadgeEstado` y `Paginacion`; sin lógica en routers (`propios` en `FiltrosPedidos` y `listar_pedidos`). Duplicación conocida y aceptada: la tarjeta de ítems/totales existe en la confirmación y en el detalle porque `entities/payment` y `entities/pedido` no pueden importar `entities/producto`/`cart` (FSD).

## Workflow follow-up

- Verify visual (design.md §UI Mockups paso 12): backend real + Vite con permiso del usuario, comparar listado, detalle y diálogo con los mockups a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-21-fe-mis-pedidos-seguimiento` y marcar `[x]` en `CHANGES.md`.
