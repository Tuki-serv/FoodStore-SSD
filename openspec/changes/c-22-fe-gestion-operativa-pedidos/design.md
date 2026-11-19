# Design — C-22 `fe-gestion-operativa-pedidos`

## Context

Motivación, contrato observado del backend y alcance: ver `proposal.md`. Requisitos: `specs/frontend-order-management` y `specs/order-api` de este change.

Puntos de partida (verificados en `dev`, 2026-11-19):

- **Backend**: listado con alcance por unión de roles y filtros `estado`/`desde`/`hasta` (UTC); detalle sin dirección; historial sin nombre del actor (la fila inicial tiene `usuario_id` del cliente y motivo «Pedido creado», `service.py:159-166`); `PATCH /estado` con FSM por roles y códigos `INVALID_TRANSITION`/`INSUFFICIENT_STOCK`; `DELETE` solo `CLIENT`. `PATCH` admite también `COCINA` en el router, pero la FSM no le da transiciones: no se toca (PA-07).
- **`entities/pedido`**: `PedidoDetalle`, `DetallePedido`, `FORMAS_PAGO`, `esConfirmacionManual`, `etiquetaEstado`/`claseEstado`, `BadgeEstado`, `EtiquetaFormaPago`, `pedidoQueries.todas()` (`['pedidos']`) y `.detalle(id)`, `useCrearPedido`. `obtenerPedido` documenta «propio» (el backend también sirve a gestores).
- **`shared/ui`**: `Dialogo` (foco atrapado, Escape, `pie`), `DialogoBaja` (confirmación destructiva), `Paginacion`, `lista-admin`, `estados` (carga/vacío/error), `Campo`. `useUiStore.notificar` para toasts.
- **Patrones**: filtros en la URL con funciones puras `leer…/aParametros` (`pages/admin-productos/model/filtro.ts`); polling con `refetchInterval` + `refetchIntervalInBackground: false` (`pages/pago-pedido`, C-20b); acceso por `ACCESO_RUTAS[RUTAS.gestionPedidos] = { roles: ['PEDIDOS','ADMIN'] }`; sub-rutas fuera de `RUTAS` como `RUTA_PRODUCTO`.

## Goals / Non-Goals

**Goals:**
- Que un `PEDIDOS`/`ADMIN` opere el ciclo completo PENDIENTE→…→ENTREGADO (o CANCELADO) sin salir de la UI, con historial legible y sin acciones que el backend vaya a rechazar por FSM/rol/forma de pago.
- Dejar en `entities/pedido` las piezas que C-21 reutiliza (listado, historial, línea de tiempo, espejo de la FSM con el rol como entrada).
- Mantener al backend como única autoridad: la UI esconde lo imposible, pero cualquier rechazo (409/403/422) se muestra bien.

**Non-Goals:**
- WebSocket, KDS, rol `COCINA` (C-26/C-27, PA-07).
- Estado del pago Mercado Pago en la gestión (PEDIDOS no lee `/pagos`).
- Filtros multi-estado, por cliente o por número, y fechas en hora local (OQ-7).
- Borrado de pedidos (OQ-4).
- Pantallas de C-21.

## Decisions

### D1 — Rutas y ubicación FSD
- `/gestion-pedidos` (ya en `RUTAS`, acceso `PEDIDOS`/`ADMIN`) → `GestionPedidosPage`; `/gestion-pedidos/:pedidoId` → `GestionPedidoDetallePage`, declarada como `RUTA_GESTION_PEDIDO` + `rutaGestionPedido(id)` en `shared/config/routes.ts` (fuera de `RUTAS`, igual que `RUTA_PRODUCTO`) y envuelta en `RequiereAcceso` con el mismo acceso. `MAPA_RUTAS` deja la entrada con dueño `C-22` para la navegación pero el router monta la página real (como hicieron C-17a/C-17b); se ajusta el test del mapa si verifica provisorias.
- **Detalle en ruta propia** (no panel lateral sobre el listado): es recargable/compartible, funciona igual en mobile y simplifica el foco. *Alternativa*: maestro-detalle en desktop (listado + panel). Se descarta por ahora: duplica layouts y estados; el listado conserva filtros en la URL, así «Volver a pedidos» vuelve al mismo lugar (el enlace guarda `location.search`).
- `pages/gestion-pedidos/`: `ui/` (`GestionPedidosPage`, `FiltrosPedidos`, `TablaPedidos`/`FilaPedido` —tabla en desktop, tarjetas en mobile con la misma semántica de lista—, `GestionPedidoDetallePage`, `TarjetaEntrega`, `AccionesPedido`, `MarcaActualizacion`, CSS); `model/` (`filtro.ts`: `leerFiltrosPedidos`, `aParametros`, `validarRango`; `INTERVALO_ACTUALIZACION_MS = 30_000`). Un único slice con dos páginas: comparten filtros/volver y no tienen otro consumidor.
- `features/cambiar-estado-pedido/`: `DialogoCambioEstado` (avance y confirmación de pago), `DialogoCancelarPedido` (sobre `DialogoBaja`), `useCambiarEstadoPedido` y la orquestación «sin stock → cancelar con «Sin stock»». Es feature porque tiene **dos consumidores** (fila del listado y detalle) y una acción de usuario con su propio motivo de cambio (FSD: extraer con 2+ consumidores).
- `entities/pedido/` (reutilizable por C-21): ver D2–D4.

### D2 — API y queries en `entities/pedido`
- Tipos nuevos: `PedidoResumen` (ítem del listado), `FiltrosListadoPedidos {estado?, desde?, hasta?, page, size}`, `EventoHistorial` (con `usuario_nombre`), `DireccionPedido`; `PedidoDetalle` suma `direccion: DireccionPedido | null`. `EstadoPedidoCodigo` como unión literal de los seis códigos (`etiquetaEstado` sigue aceptando `string` por robustez).
- `listarPedidos(filtros)` → `GET /pedidos/` con `params` (sin claves vacías); `obtenerHistorial(id)` → `GET /pedidos/{id}/historial`; `cambiarEstadoPedido(id, {nuevo_estado, motivo?})` → `PATCH /pedidos/{id}/estado`.
- Claves jerárquicas bajo `['pedidos']`: `lista(filtros)` = `['pedidos','lista',filtros]` con `placeholderData: keepPreviousData` (paginación/filtros sin parpadeo); `detalle(id)` (existente); `historial(id)` = `['pedidos','historial',id]`. El alcance lo decide el backend por roles, así que la misma `lista` sirve a C-21.
- `useCambiarEstadoPedido()` (en la feature): `onSuccess` siembra `detalle(id)` con la respuesta e invalida `['pedidos']` (listas e historial se vuelven a pedir; el detalle recién sembrado no). En 409 `INVALID_TRANSITION` invalida `detalle(id)` e `historial(id)` para mostrar el estado real. Sin actualización optimista: el cambio dispara stock/historial en el servidor y un rollback visual confundiría.

### D3 — Espejo de la FSM para la UI
`accionesGestion(estado, formaPago): AccionPedido[]` (puro, en `entities/pedido/model/transiciones.ts`), con `AccionPedido = {destino, etiqueta, tipo: 'avance' | 'confirmar-pago' | 'cancelar'}`:

| Estado | EFECTIVO / TRANSFERENCIA | MERCADOPAGO |
|---|---|---|
| PENDIENTE | Confirmar pago, Cancelar pedido | Cancelar pedido (+ aviso «Se confirma solo cuando Mercado Pago aprueba el pago») |
| CONFIRMADO | Pasar a preparación, Cancelar pedido | ídem |
| EN_PREP | Despachar, Cancelar pedido | ídem |
| EN_CAMINO | Marcar entregado | ídem |
| ENTREGADO / CANCELADO | — | — |

`proximoAvance(estado, formaPago)` devuelve la única acción no-cancelar (para la fila del listado). Los roles no entran a la función de gestión porque la ruta ya exige `PEDIDOS`/`ADMIN` y ambos tienen la misma tabla (`fsm.py` `_GESTION`); para C-21 se agrega luego `accionesCliente` en el mismo archivo. Es una **copia** de la tabla del backend (R1): un test de tabla la fija y comenta la fuente (`backend/app/modules/pedidos/fsm.py`). *Alternativa*: que el backend devuelva `acciones_permitidas` en el detalle — fuente única, pero amplía el contrato y el listado; se deja para C-25b si la copia molesta.

### D4 — Historial como línea de tiempo
`LineaTiempoHistorial` en `entities/pedido/ui` (C-21 la reutiliza): lista ordenada (`<ol>`) en el orden del servidor; por evento: punto con el color del estado, título (`estado_desde === null` → «Pedido creado»; si no, `etiquetaEstado(estado_hacia)`), autor (`usuario_nombre` ?? «Sistema» si `usuario_id` es nulo ?? `Usuario #N`), fecha y hora local (`Intl.DateTimeFormat('es-AR', …)`) y motivo/observación en texto secundario (el motivo «Pedido creado» de la fila inicial no se repite). Cancelación resaltada con el color de peligro. Se pide con `useQuery(pedidoQueries.historial(id))` en paralelo con el detalle; si falla, el detalle se muestra igual y el bloque de historial muestra su propio error con «Reintentar».

### D5 — Listado, filtros y paginación
- Filtros en la URL: `?estado=&desde=&hasta=&page=` con funciones puras (patrón C-17b); valores inválidos vuelven al defecto (estado desconocido → «Todos»; fecha mal formada → vacía). Cambiar un filtro resetea `page`.
- Estado: `select` «Estado» con «Todos» + seis estados (control nativo, accesible y compacto en mobile). *Alternativa*: chips por estado (más visual, ocupa una fila entera en mobile) — la decide el mockup.
- Fechas: dos `input type="date"` «Desde»/«Hasta»; `validarRango` bloquea el pedido si `desde > hasta` (mensaje de la spec). Leyenda bajo el grupo: «Fechas según el día del servidor (UTC)» mientras OQ-7 siga con el defecto.
- `size` 20 (defecto del backend); `Paginacion` de `shared/ui`. Contador «N pedidos».
- Vacíos: sin filtros «Todavía no hay pedidos»; con filtros «No hay pedidos con estos filtros» + «Limpiar filtros».

### D6 — Actualización periódica (sin WebSocket)
`refetchInterval: INTERVALO_ACTUALIZACION_MS` (30 s) y `refetchIntervalInBackground: false` en `lista` y en `detalle`/`historial` mientras la página está montada; `refetchOnWindowFocus` por defecto (vuelve a pedir al volver a la pestaña). `MarcaActualizacion` muestra «Actualizado a las HH:MM» desde `dataUpdatedAt` y el botón «Actualizar» (`refetch`, deshabilitado con spinner mientras `isFetching`). Las respuestas periódicas no vacían la vista (`keepPreviousData`), y un error en una actualización periódica con datos previos se muestra como aviso discreto, no como pantalla de error. Mientras un diálogo está abierto la actualización sigue: el diálogo trabaja sobre el id y el destino elegidos; si el pedido cambió, el 409 lo resuelve (D8). Tests con `vi.useFakeTimers({ shouldAdvanceTime: true })` avanzando 30 s y contando pedidos en MSW.

### D7 — Diálogos de cambio de estado
- `DialogoCambioEstado` (sobre `Dialogo`): título por acción («Confirmar pago del pedido #58», «Pasar a preparación el pedido #57», «Despachar el pedido #57», «Marcar entregado el pedido #57»), línea «Pendiente → Confirmado» con los distintivos, texto de ayuda por acción (confirmar pago: «Confirmás que el local recibió el pago en efectivo/por transferencia. Al confirmar se descuenta el stock.»; despachar: muestra la entrega —dirección o retiro—), campo «Observación (opcional)» `textarea` máx. 300 con contador, botones «Cancelar» y el primario con la etiqueta de la acción («Guardando…» con spinner mientras `isPending`, que además bloquea Escape y el cierre).
- `DialogoCancelarPedido` (sobre `DialogoBaja`): título «Cancelar el pedido #58», aviso «La cancelación no se puede deshacer.» + (si `CONFIRMADO`/`EN_PREP`) «El stock de sus productos se devuelve.», «Motivo» obligatorio (máx. 300, recortado; vacío → «Escribí el motivo de la cancelación», foco al campo), botón peligro «Cancelar pedido», secundario «Volver».
- Formulario: un solo campo con validación simple; se usa **TanStack Form** para mantener la convención del proyecto (validación + envío + estados `isSubmitting`), con `onSubmit` → `mutateAsync`.
- Éxito: cerrar, foco al botón que abrió el diálogo (o al encabezado del detalle si la acción ya no existe), toast `success` «Pedido #57 en preparación» / «Pedido #58 confirmado» / «Pedido #58 cancelado».

### D8 — Errores del cambio de estado
`clasificarErrorCambioEstado(error: ApiError)` (puro, en `entities/pedido/model`): por `code`/`status`, nunca por texto:
- `409` + `INSUFFICIENT_STOCK` → `sin-stock`: alerta con el `detail` («No hay stock suficiente para X»), el pedido sigue `PENDIENTE`, acción «Cancelar por falta de stock» que cierra este diálogo y abre `DialogoCancelarPedido` con motivo «Sin stock» precargado (mismo texto que usa el Sistema, `MOTIVO_SIN_STOCK`).
- `409` + `INVALID_TRANSITION` → `transicion`: alerta con el `detail` + «El pedido cambió mientras lo mirabas.»; invalida detalle/historial/lista; botón primario pasa a «Cerrar».
- `422` (`field: motivo`) → `motivo`: error en el campo (defensa; la UI ya lo valida).
- `403` → `sin-permiso`; `404` → `no-existe`; `status === null` o `>= 500` → `conexion` con «Reintentar» (reenvía lo mismo); otro → `otro` con el `detail`.
La alerta vive dentro del diálogo (`role="alert"`), no se pierde lo escrito.

### D9 — Detalle
Encabezado: «Pedido #58», `BadgeEstado`, fecha/hora, «Volver a pedidos». Columna principal: cliente (`cliente_nombre`), `EtiquetaFormaPago`, `TarjetaEntrega` (con `direccion`: alias en negrita + `linea1`, `linea2`, `ciudad`, `provincia`, `codigo_postal`; sin dirección: «Retiro en el local»), ítems (nombre, «Sin …» desde `personalizacion_snapshot`, `cantidad ×`, subtotal), totales y notas («Nota del cliente»). Columna lateral (debajo en mobile): `AccionesPedido` (primaria = avance; «Cancelar pedido» como botón secundario de peligro; aviso Mercado Pago cuando aplica) y `LineaTiempoHistorial`. Estados: carga (skeleton), 404 → «No encontramos este pedido», 403 → «Sin permiso» (no debería ocurrir para gestores), red/5xx → error con «Reintentar».

### D10 — Backend aditivo (OQ-2, OQ-3)
- `DireccionPedidoRead {id, alias, linea1, linea2, ciudad, provincia, codigo_postal}` en `pedidos/schemas.py`; `PedidoDetalle.direccion: DireccionPedidoRead | None = None`. `_armar_detalle` la obtiene por el UoW de pedidos (repositorio de direcciones agregado al `PedidoUnitOfWork`, sin pasar por `DireccionService` —que exige dueño— y **sin filtrar `deleted_at`**: la dirección borrada después del pedido se sigue mostrando, R4). Respeta capas: service → uow → repository.
- `HistorialEstadoPedidoRead.usuario_nombre: str | None`; `HistorialRepository.get_all_by_pedido_id_con_usuario` con `LEFT JOIN usuario` (un solo query, sin N+1), manteniendo el orden `created_at, id`. El repositorio sigue siendo append-only.
- Sin migración (solo lectura), sin rutas nuevas, sin cambios de permisos. Tests en `backend/tests/integration/test_pedidos_contrato.py` (o archivo nuevo `test_pedidos_gestion.py`) contra `foodstore_test`.
*Alternativa*: no tocar backend y mostrar «Envío a domicilio (dirección #12)» y «Usuario #N». Se descarta como defecto porque sin dirección no se puede despachar (US-020 incluye `EN_CAMINO`).

### D11 — Tests (Strict TDD)
- **Backend (pytest, PostgreSQL)**: detalle con `direccion` para gestor y dueño, `null` en retiro, dirección soft-deleted aún visible; historial con `usuario_nombre` del gestor, del cliente (fila inicial) y `null` del Sistema; orden intacto; regresión de los contratos existentes.
- **Puros (Vitest)**: `accionesGestion`/`proximoAvance` (tabla completa 6 estados × 3 formas), `clasificarErrorCambioEstado`, `leerFiltrosPedidos`/`aParametros`/`validarRango`, autor del evento de historial.
- **MSW** (`test/msw/pedidos.ts` ampliado): estado en memoria de pedidos e historial; `GET /pedidos/` con filtros y paginación reales sobre el estado; `GET /pedidos/:id/historial`; `PATCH /pedidos/:id/estado` que aplica la tabla de la FSM y registra cuerpos recibidos, con respuestas forzables por test (409 stock/transición, 403, 404, 422, 500, red, demora) y contador de pedidos por ruta.
- **Páginas (RTL, `renderApp`)**: acceso por rol; listado/filtros/URL/paginación/vacíos/error; polling (30 s con fake timers; pestaña oculta sin pedidos vía `document.visibilityState`); detalle con dirección/retiro/historial; **botones por estado × forma de pago × rol** (`ADMIN` y `PEDIDOS` iguales); flujos de diálogo (avance con/sin observación, doble clic, confirmar pago, sin stock → cancelar con «Sin stock», cancelar sin motivo, 409 transición, red + reintento, foco de vuelta); fila del listado con próxima acción. axe en listado, detalle y diálogo con error. Sin `vi.mock` de módulos propios; `userEvent.setup()`.

## Risks / Trade-offs

- **R1 [FSM duplicada en el frontend]** Si el backend cambia la tabla, la UI ofrece de más o de menos. → La UI solo esconde: el backend decide y D8 muestra su 409; test de tabla con comentario de la fuente; alternativa `acciones_permitidas` registrada para C-25b.
- **R2 [Fechas en UTC]** Un pedido creado a las 22:00 en Argentina (UTC−3) cae en el día siguiente para el filtro, pero la tabla lo muestra con fecha local. → Leyenda visible (D5) y OQ-7; arreglo de fondo (parámetro de zona o `datetime` en el filtro) para C-25b.
- **R3 [Polling: costo y frescura]** 30 s implica pedidos cada medio minuto por gestor y hasta 30 s de atraso. → Solo con la pestaña visible; «Actualizar» manual; el 409 cubre la carrera entre gestores. WebSocket queda en C-27.
- **R4 [Dirección viva, no snapshot]** El pedido guarda `direccion_id`, no una copia: si el cliente edita la dirección después, el gestor ve la nueva; si la borra (soft delete) se sigue viendo; `ON DELETE SET NULL` solo aplica a un borrado físico (no existe por API). → Aceptado; `direccion_snapshot` es regla `[DESC]` no normativa (DD-17).
- **R5 [Cancelar un pedido Mercado Pago ya pagado]** No hay reembolso automático (KB/07 Flujo 7). → El diálogo de cancelación de un `CONFIRMADO` `MERCADOPAGO` agrega «Si el cliente ya pagó con tarjeta, el reintegro se gestiona aparte en Mercado Pago».
- **R6 [Listado de un solo estado]** No hay vista «activos» (no terminales) porque el backend filtra un estado por vez. → Defecto «Todos» ordenado por fecha; OQ-1/OQ-7.
- **R7 [Spec vs KB sobre eliminar]** RN-PE-12 («solo ADMIN elimina, soft delete») contradice `order-api` «Los pedidos no se borran por API» (C-11). → OQ-4; por defecto rige la spec y se corrige la KB al cerrar.

## Migration Plan

Sin migraciones de base. El cambio de backend es aditivo (dos campos nuevos en respuestas); el frontend de C-19/C-20 ignora los campos extra. Despliegue: backend y frontend juntos en `dev`. Rollback: revertir el commit (no hay datos nuevos).

## Open Questions

> Governance MEDIO. Cada pregunta tiene una **propuesta por defecto** que ya reflejan specs y tareas (y reflejarán los mockups); el usuario las confirma junto con la aprobación de mockups. Si alguna respuesta difiere, se ajustan specs, mockups y tareas antes de `/opsx:apply`.
>
> **Resolución (2026-11-19, por el usuario):** OQ-1..OQ-8 aprobadas con su propuesta por defecto. Los mockups se arman sobre esos defectos.

- **OQ-1 — Forma del tablero.** Defecto: **listado paginado** (tabla en desktop, tarjetas en mobile) con filtro de estado y fechas, más nuevos primero, y la **próxima acción en cada fila** (D1, D5). Alternativa: tablero kanban por columnas de estado (requiere una consulta por estado y no escala con pedidos terminados).
- **OQ-2 — Dirección de entrega para el gestor (brecha backend).** Defecto: **sumar `direccion` al detalle** (D10, spec `order-api`). Alternativa: no tocar backend y mostrar solo «Envío a domicilio» (no permite despachar con la UI).
- **OQ-3 — Autor de cada cambio en el historial (brecha backend).** Defecto: **sumar `usuario_nombre` al historial** (D10). Alternativa: mostrar «Sistema» / «Usuario #N» sin tocar backend.
- **OQ-4 — «Eliminar» de US-022.** Defecto: **no hay borrado**; «cancelar con motivo» es la única baja (rige `order-api` «Los pedidos no se borran por API», C-11) y al cerrar se corrige RN-PE-12 en KB/05. Alternativa: endpoint de soft delete solo `ADMIN` (backend + spec + filtro de eliminados; cambio aparte).
- **OQ-5 — Observación al avanzar.** Defecto: **diálogo de confirmación en cada avance** con observación opcional (máx. 300) y motivo obligatorio para cancelar (máx. 300) (D7). Alternativa: avance en un clic sin diálogo (más rápido, más errores; la observación quedaría solo en el detalle).
- **OQ-6 — Actualización.** Defecto: **polling cada 30 s** con la pestaña visible, botón «Actualizar» y hora de última actualización; sin sonido ni aviso de «pedido nuevo» (D6). Alternativa: otro intervalo, o resaltar los pedidos nuevos desde la última vista.
- **OQ-7 — Filtros.** Defecto: **un estado o «Todos» + rango de fechas en UTC** con leyenda, sin búsqueda por cliente/número (lo que soporta el backend hoy; R2, R6). Alternativa: ampliar el backend (varios estados, «activos», zona horaria, búsqueda) en este change o en C-25b.
- **OQ-8 — Pedido `MERCADOPAGO` pendiente.** Defecto: **solo «Cancelar pedido» + aviso** «Se confirma solo cuando Mercado Pago aprueba el pago», sin mostrar el estado del pago (PEDIDOS no tiene acceso a `/pagos`). Alternativa: mostrar el último intento de pago (requiere abrir `/pagos` a PEDIDOS o sumarlo al detalle: backend + RBAC).

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-22-fe-gestion-operativa-pedidos/mockups/`
- Approval: approved (2026-11-19, by user). Ajustes aprobados junto con los mockups: (1) el botón secundario de los diálogos de avance dice «Volver»; (2) solo «Confirmar pago» va relleno en la fila, los demás avances con borde, y `PENDIENTE` `MERCADOPAGO` muestra «Espera el pago en Mercado Pago»; (3) en el detalle mobile (<768 px) la tarjeta «Acciones» va arriba, antes de «Cliente y entrega» (cambio respecto de la captura; aplicar en la implementación). Pendiente de verificar en apply: envío de $ 50 en pedidos con retiro en el local (#57).
- Preview: rendered (2026-11-19, mockups/previews/ — 36 estados × 1440x900 y 390x844 + 10 páginas completas en previews/full/; Edge headless + playwright-core desde file://, Playwright MCP sin Chrome en esta máquina)

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844):

| Pantalla / estado | Notas |
|---|---|
| Listado con datos (varios estados y formas de pago, próxima acción por fila) | tabla en desktop, tarjetas en mobile; panel lateral con «Gestión de pedidos» activo |
| Listado con filtros aplicados (estado + fechas) y paginación | incluye leyenda UTC y «Limpiar filtros» |
| Error de rango de fechas («Desde» > «Hasta») | |
| Listado cargando (primera vez) | skeleton |
| Listado vacío sin filtros / sin resultados con filtros | |
| Listado con error del servidor («Reintentar») y aviso discreto de actualización fallida con datos previos | |
| Marca de actualización («Actualizado a las HH:MM», «Actualizar» girando) | |
| Detalle `PENDIENTE` `EFECTIVO` (Confirmar pago + Cancelar) con historial de 1 evento | dirección de entrega visible |
| Detalle `PENDIENTE` `MERCADOPAGO` (solo Cancelar + aviso) | |
| Detalle `CONFIRMADO` / `EN_PREP` / `EN_CAMINO` (acción primaria correspondiente) con historial de varios eventos, uno del «Sistema» | uno con «Retiro en el local» y nota del cliente |
| Detalle `ENTREGADO` y `CANCELADO` (sin acciones; cancelación resaltada en el historial) | |
| Detalle cargando, no encontrado, error con historial fallido aparte | |
| Diálogo «Confirmar pago» (texto DD-22/stock) en reposo y enviando | |
| Diálogo «Confirmar pago» con error sin stock y «Cancelar por falta de stock» | |
| Diálogo «Pasar a preparación» / «Despachar» (con entrega) con observación | |
| Diálogo con error «El pedido cambió mientras lo mirabas» y con error de conexión («Reintentar») | |
| Diálogo «Cancelar pedido» vacío, con error «Escribí el motivo…», con motivo «Sin stock» precargado, y variante `CONFIRMADO` con aviso de stock devuelto / reintegro Mercado Pago | |
| Toast de éxito tras un avance | |
| Variaciones por rol: `PEDIDOS` (panel sin «Administración») y `ADMIN` (con «Administración»), mismas acciones; `CLIENT` → «Sin permiso» | |
