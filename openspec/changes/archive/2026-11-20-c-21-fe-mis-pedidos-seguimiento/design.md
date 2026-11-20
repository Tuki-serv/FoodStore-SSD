# Design — C-21 `fe-mis-pedidos-seguimiento`

## Context

Motivación, contrato observado del backend y alcance: ver `proposal.md`. Requisitos: `specs/frontend-my-orders`, `specs/order-api` y `specs/frontend-app-shell` de este change.

Puntos de partida (verificados en `dev`, 2026-11-19):

- **Backend**: listado con alcance por unión de roles (`service.py:401-411`; gestor = todos) y filtros `estado`/`desde`/`hasta` en `FiltrosPedidos` (`filtros.py:9-14`, dataclass inyectada con `Depends()` en `router.py:46`); detalle con `direccion` e `items` y historial con `usuario_nombre` para el dueño (C-22); `DELETE /pedidos/{id}` solo `CLIENT` y dueño, body `{motivo}` opcional con defecto «Cancelado por el cliente» (`service.py:420-432`), FSM del cliente PENDIENTE/CONFIRMADO → CANCELADO (`fsm.py:48-50`), devolución de stock desde CONFIRMADO/EN_PREP (`service.py:45, 327-328`); `GET /pagos/{pedido_id}` para el dueño (`pagos/service.py:71-76`).
- **`entities/pedido`** (C-19/C-20b/C-22): `pedidoQueries.lista(filtros)` (`keepPreviousData`), `.detalle(id)`, `.historial(id)`, `.todas()`; `listarPedidos` arma `params` sin claves vacías; `LineaTiempoHistorial` (autor fijo por `autorEvento`), `EntregaDelPedido`, `BadgeEstado`, `EtiquetaFormaPago`, `fechaHoraCorta`/`fechaLocal`/`horaLocal`, `clasificarErrorCambioEstado`, `transiciones.ts` (`accionesGestion`, FSM de gestión; deja lugar para la del cliente).
- **`features/cambiar-estado-pedido`** (C-22): `DialogoCancelarPedido` sobre `DialogoBaja` con `CampoTexto`, `AlertaCambio`, `PieDialogo` y `useEnvioCambio` (un envío a la vez, error clasificado), atado a `PATCH /estado` por `useCambiarEstadoPedido`. Textos pensados para el gestor («Si el cliente ya pagó…»).
- **`pages/gestion-pedidos`** (C-22): `MarcaActualizacion`/`AvisoActualizacionFallida` (genéricos, hoy privados de la página), tabla en desktop y tarjetas en mobile, detalle en dos columnas con «Acciones» arriba en mobile, `INTERVALO_ACTUALIZACION_MS = 30_000`.
- **`pages/pedido-creado`** (C-19/C-20b): `LineaEstadoPago`, `PagoEnConfirmacion`, `TraspasoPago` (privados de la página); texto «No encontramos este pedido».
- **`shared`**: `Dialogo`, `DialogoBaja` (con `children`), `Paginacion`, `estados` (`EstadoError`, vacío, carga), `useUiStore.notificar`, `useSesion` (usuario con `id`) en `entities/session`. `ACCESO_RUTAS[RUTAS.misPedidos] = 'sesion'`.

## Goals / Non-Goals

**Goals:**
- Que el cliente encuentre sus pedidos, entienda en qué paso está cada uno y qué falta (pago o confirmación del local), y pueda cancelar mientras se puede, sin pedir nada que el backend vaya a rechazar.
- Reutilizar lo de C-22 (queries, línea de tiempo, diálogo de cancelación, marca de actualización) en vez de duplicarlo; mover a la capa común lo que pasa a tener dos consumidores.
- El backend sigue siendo la autoridad: la UI esconde lo imposible y muestra bien cualquier rechazo.

**Non-Goals:**
- WebSocket del seguimiento (C-27) y nada de `COCINA` (PA-07).
- Filtro por fecha en «Mis pedidos» (solo por estado, OQ-4 resuelta), repetir un pedido, reintegros de Mercado Pago.
- Cambiar la página de confirmación o de pago más allá de mover sus componentes de pago (sin cambio visible).

## Decisions

### D1 — Rutas y ubicación FSD
- `/mis-pedidos` (ya en `RUTAS`, acceso `'sesion'`) → `MisPedidosPage`; `/mis-pedidos/:pedidoId` → `MiPedidoDetallePage`, declarada como `RUTA_MI_PEDIDO` + `rutaMiPedido(id)` en `shared/config/routes.ts` (fuera de `RUTAS`, como `RUTA_GESTION_PEDIDO`) y envuelta en el guard de sesión. `MAPA_RUTAS` conserva la entrada con dueño `C-21` para la navegación y el router monta la página real (igual que C-22); el ejemplo de provisoria de los tests pasa a `/admin/usuarios` (spec `frontend-app-shell`).
- **Acceso por sesión, no por rol `CLIENT`**: la spec del shell muestra «Mis pedidos» a `PEDIDOS` y `ADMIN`; un gestor sin pedidos ve el vacío. La protección de alcance es `propios=true` (D2) y la comprobación de dueño en el detalle (D5). *Alternativa*: exigir `CLIENT` (cambia la navegación de tres roles y la spec del shell; un usuario `CLIENT`+`PEDIDOS` seguiría necesitando `propios`).
- `pages/mis-pedidos/`: `ui/` (`MisPedidosPage`, `ListaMisPedidos` —tabla en desktop, tarjetas en mobile—, `MiPedidoDetallePage`, `ProgresoPedido`, `AccionesMiPedido`, `PedidoNoEncontrado`, `FiltroMisPedidos`, CSS); `model/` (`leerFiltroMisPedidos`, `aParametros`, `debeActualizarLista`, `TAMANO_PAGINA = 10`). Un único slice con dos páginas, como `gestion-pedidos`.
- **Promovidos por tener dos consumidores** (FSD: extraer con 2+): `MarcaActualizacion` y `AvisoActualizacionFallida` de `pages/gestion-pedidos/ui` a `shared/ui/marca-actualizacion` (son genéricos: hora, `isFetching`, `refetch`); `LineaEstadoPago`, `PagoEnConfirmacion`, `TraspasoPago` de `pages/pedido-creado/ui` a `entities/payment/ui` (dependen de `EstadoPagoPedido` y de `rutaPagoPedido`), junto con sus reglas CSS (`.handoff`, `.pay-line`, `.reason-inline`, hoy en `pedido-creado.css`) en un `pago.css` de la entidad. Mover sin cambiar comportamiento: los tests de C-19/C-20b/C-22 siguen verdes sin tocarlos (solo cambian los imports de producción). `INTERVALO_ACTUALIZACION_MS` pasa a `shared/config` por la misma razón. El estado como filtro también pasa a tener dos consumidores (D4): ver D11.

### D2 — Backend: filtro `propios` (OQ-1)
- `FiltrosPedidos.propios: bool = False` en `filtros.py` (query param `?propios=true`, lo parsea FastAPI desde la dataclass como los demás); `listar_pedidos` calcula `alcance = usuario_id if filtros.propios or not gestor else None`. Sin cambios en el repositorio (ya recibe `usuario_id`), ni en rutas, permisos o esquema. Cumple «los filtros nunca amplían el alcance».
- Tests (pytest, `foodstore_test`): usuario `CLIENT`+`PEDIDOS` con `propios=true` ve solo los suyos y `total` coincide; sin el filtro sigue viendo todos (regresión de «Unión de CLIENT y PEDIDOS»); `CLIENT` con `propios=true` = sin filtro; combinado con `estado`; valor inválido (`propios=quizas`) → 422 `field: propios`.
- Frontend: `FiltrosListadoPedidos.propios?: true`; `listarPedidos` lo envía solo si está; `MisPedidosPage` siempre usa `{ propios: true, estado?, page, size: 10 }` (`estado` solo si hay filtro, D4). `GET /pedidos` ya combina `estado` con el alcance (`repository.py` `listar`: `usuario_id` y `filtros.estado` son `where` independientes), así que el filtro del cliente no pide más backend que `propios`; la combinación `propios=true&estado=…` queda cubierta por el test de 2.3. La clave de query incluye el filtro, así que no se mezcla con la caché de `gestion-pedidos`.

### D3 — Cancelación del cliente (`DELETE`), reutilizando el diálogo de C-22
- `entities/pedido/api`: `cancelarMiPedido(id, motivo)` → `apiClient.delete<PedidoDetalle>('/pedidos/{id}', { data: { motivo } })` (axios manda el body en `DELETE` con `data`). `entities/pedido/model/transiciones.ts`: `puedeCancelarCliente(estado)` (`PENDIENTE`/`CONFIRMADO`, copia de `fsm.py` `TRANSICIONES[CLIENT]`, R1 de C-22) con test de tabla.
- `features/cambiar-estado-pedido`: el envío se generaliza sin duplicar el diálogo. `useEnvioCambio` pasa a recibir la mutación (`useCambiarEstadoPedido` o la nueva `useCancelarMiPedido`) y `DialogoCancelarPedido` recibe `destinatario: 'gestion' | 'cliente'` que elige mutación y textos (aviso de stock solo para gestión; para el cliente con `CONFIRMADO` `MERCADOPAGO`: «Si ya pagaste con Mercado Pago, el reintegro no es automático: lo gestionás con el local.»; placeholder «Por ejemplo: me equivoqué de dirección»). Se exporta `CancelarMiPedido` (botón «Cancelar pedido» + diálogo + foco + aviso de éxito) para el detalle. `useCancelarMiPedido` repite la política de caché de `useCambiarEstadoPedido` (siembra `detalle(id)`, invalida `['pedidos']` salvo ese detalle; en `transicion` invalida todo) extrayendo esa política a una función compartida dentro de la feature.
- *Alternativa*: feature nueva `cancelar-mi-pedido` con su diálogo. Se descarta: duplicaría `CampoTexto`/`AlertaCambio`/`PieDialogo` (no se pueden importar entre features) o forzaría subirlos a `shared/ui` con textos de pedido.
- `clasificarErrorCambioEstado` sirve igual (`DELETE` devuelve los mismos `code`); los textos de `AlertaCambio` para el cliente cambian solo en `transicion` («Tu pedido ya avanzó y no se puede cancelar») y en 403/404 («Este pedido no está disponible»).
- **Motivo obligatorio solo en la UI (OQ-2)**: el diálogo no envía sin motivo (mismo mensaje que gestión). El backend mantiene el defecto «Cancelado por el cliente» que fija la spec `order-api` (C-11).

### D4 — Listado
- Estado del listado en la URL `?estado=&page=` con `leerFiltroMisPedidos(parametros)` puro (estado desconocido → sin filtro; página no entera o < 1 → 1) y `aParametros` (los valores por defecto no dejan rastro), mismo patrón que `leerFiltrosPedidos` de C-22; `Paginacion` de `shared/ui`; `size` 10 (los pedidos de un cliente son pocos y las tarjetas en mobile son altas; el backend acepta cualquier `size` ≤ 100).
- Desktop: tabla (Pedido #, Fecha, Forma de pago, Total, Estado, «Ver detalle»); mobile: tarjetas con la misma semántica de lista. Fila/tarjeta entera enlaza al detalle; los pedidos en curso (no terminados) llevan una marca sutil «En curso» en vez de ordenarse aparte (el backend ordena por fecha).
- **Filtro por estado (OQ-4 resuelta)**: `FiltroMisPedidos`, un `<form aria-label="Filtro de mis pedidos">` sobre la barra de resumen con un `select` nativo con etiqueta visible «Estado»: «Todos» + los seis estados con `etiquetaEstado` (Pendiente, Confirmado, En preparación, En camino, Entregado, Cancelado), mismo aspecto que el filtro de C-22 (`.gp-filters`) pero sin fechas. Cambiar el estado escribe `?estado=` y **vuelve a la página 1**; «Todos» quita el parámetro. Con filtro activo aparece «Limpiar filtro» (botón-enlace, como «Limpiar filtros» de gestión) que deja `/mis-pedidos`. El filtro se ve siempre (también en carga, vacío y error), como en C-22. Resumen: «12 pedidos» sin filtro, «12 pedidos en Entregado» con filtro. La marca «En curso» y el paginado de a 10 no cambian.
- Vacío sin filtro: «Todavía no hiciste pedidos» + «Ver catálogo». **Vacío con filtro** (distinto): «No tenés pedidos en ese estado» + «Probá con otro estado.» + botón «Limpiar filtro». Error: `EstadoError` + «Reintentar». Carga: skeleton.
- Sin filtro por fecha: los pedidos de un cliente son pocos y el orden por fecha ya resuelve «el último».

### D5 — Detalle
- Se pide `detalle(id)` y, en paralelo, `historial(id)`; si `pedido.usuario_id !== sesion.usuario.id` se muestra `PedidoNoEncontrado` (un gestor puede leer cualquier pedido: «Mis pedidos» no lo muestra). 403/404 → mismo texto; red/5xx → `EstadoError`.
- Encabezado: «Pedido #58», `BadgeEstado`, «Hecho el 19/11 a las 14:32», «Volver a mis pedidos», `MarcaActualizacion` si no está terminado.
- Columna principal: `ProgresoPedido` (D6) con la línea «qué sigue», bloque de pago (D7), «Entrega» (`EntregaDelPedido`), forma de pago, ítems y totales (mismo armado que la confirmación de C-19), notas. Columna lateral: «¿Cambiaste de idea?» (D3: «Cancelar pedido» o la explicación de por qué ya no se puede; no se muestra en terminados) e «Historial» (`LineaTiempoHistorial`). En una columna (<1024 px) el orden es Seguimiento → «¿Cambiaste de idea?» → Entrega y pago → Productos → Historial (patrón «Acciones arriba» aprobado en C-22); en <720 px los pasos del progreso van en vertical.

### D6 — Progreso del pedido (OQ-6)
- `pasosProgreso(estado)` puro en `entities/pedido/model` → los cinco pasos con `'cumplido' | 'actual' | 'pendiente'`; `CANCELADO` devuelve `null` y la UI muestra la banda «Pedido cancelado» con el motivo (último evento del historial con `estado_hacia` `CANCELADO`; si el historial no cargó, sin motivo). Lista ordenada con texto accesible «Paso actual: En preparación».
- Línea «qué sigue» por estado y forma de pago: `PENDIENTE` `EFECTIVO`/`TRANSFERENCIA` «El local confirma tu pedido cuando recibe el pago.»; `PENDIENTE` `MERCADOPAGO` «Se confirma cuando Mercado Pago aprueba el pago.»; `CONFIRMADO` «El local va a empezar a prepararlo.»; `EN_PREP` «Tu pedido se está preparando.»; `EN_CAMINO` «Tu pedido va en camino.» o «Tu pedido está listo para retirar.» si no tiene dirección; `ENTREGADO` «Entregado el 19/11 a las 15:10» (fecha del evento).
- Para retiro en el local el paso 4 se llama «Listo para retirar» (el backend pasa igual por `EN_CAMINO`); el distintivo del estado sigue diciendo «En camino» (no se toca `etiquetaEstado`).

### D7 — Estado del pago (OQ-3)
- Solo `MERCADOPAGO`: `useQuery({ ...pagoQueries.estado(id), enabled })`, con el mismo intervalo que el detalle mientras el pedido esté `PENDIENTE`. Fila «Pago» con `LineaEstadoPago`; si `PENDIENTE` y el pago no está pendiente/aprobado/a devolver, `TraspasoPago` («Pagar $ 3.850 con tarjeta» / «Reintentar el pago de $ 3.850»); si está pendiente, `PagoEnConfirmacion`. Misma lógica que `pedido-creado` (se extrae a `vistaPagoDelPedido(pedido, pago)` pura en `entities/payment` para no copiarla).
- Un 404 de `/pagos` (todavía sin intento) se trata como «sin pago» (como hoy en la confirmación).

### D8 — Historial para el cliente (OQ-5)
- `LineaTiempoHistorial` recibe `autor?: (evento) => string` (por defecto `autorEvento`: gestión no cambia). El detalle del cliente pasa `autorEventoCliente(evento, usuarioId)`: `usuario_id === usuarioId` → «Vos»; `null` → «Automático»; otro → «El local». No se muestra el nombre del personal.
- El estilo de autor «Sistema» (`.sys`) se aplica también a «Automático».

### D9 — Actualización periódica
- Detalle e historial: `refetchInterval: (q) => esTerminal(q.state.data?.estado_codigo) ? false : INTERVALO_ACTUALIZACION_MS`, `refetchIntervalInBackground: false`; el historial usa el estado del detalle (lee la caché del detalle). Listado: `refetchInterval` activo solo si `debeActualizarLista(items)` (algún pedido de la página no terminado). `keepPreviousData` evita vaciar; error con datos previos → `AvisoActualizacionFallida`.
- Tests con `vi.useFakeTimers({ shouldAdvanceTime: true })` y `document.visibilityState`, como C-22.
- Con filtro, `debeActualizarLista` mira la página filtrada: «Entregado» o «Cancelado» no se actualizan solos; «Pendiente» sí, y un pedido que avanza sale del listado en la próxima actualización (R7).

### D11 — Estado como filtro compartido por gestión y cliente
- `ESTADOS_FILTRABLES` y el guard `esEstado` hoy viven privados en `pages/gestion-pedidos/model/filtro.ts` y `ui/filtros-pedidos.tsx` (duplicado). Con un segundo consumidor se mueven a `entities/pedido/model/estados.ts` como `ESTADOS_PEDIDO` (los seis códigos, en el orden de la FSM) y `esEstadoPedido(valor): valor is EstadoPedidoCodigo`; y el `select` («Todos» + etiquetas) pasa a `entities/pedido/ui/selector-estado-pedido.tsx` (`SelectorEstadoPedido({ id, valor, onCambiar })`, sin etiqueta propia: cada página lo envuelve en `Campo`). Es dominio de pedido, no genérico: `shared` no conoce estados; `entities` puede ser importado por ambas páginas sin romper FSD (nada de importar entre páginas).
- `gestion-pedidos` pasa a importarlos (sin cambio de comportamiento; sus tests siguen verdes sin tocarlos). La lectura de página (`paginaValida`) sigue local en cada página, como en `admin-productos`/`admin-ingredientes`: es una línea y extraerla excede este change.
- *Alternativa*: copiar el `select` en `mis-pedidos`. Se descarta por la regla de DRY del proyecto.

### D10 — Tests (Strict TDD)
- **Backend (pytest, PostgreSQL)**: D2.
- **Puros (Vitest)**: `puedeCancelarCliente` (6 estados), `pasosProgreso` (6 estados + retiro), `autorEventoCliente`, `esEstadoPedido`, `leerFiltroMisPedidos`/`aParametros`, `debeActualizarLista`, `vistaPagoDelPedido`, `listarPedidos` con `propios`.
- **MSW** (`test/msw/pedidos.ts`): `DELETE /pedidos/:id` que aplica la FSM del cliente, valida dueño y registra cuerpos, con respuestas forzables (409, 403, 404, 500, red, demora); `GET /pedidos/` respeta `propios` y `usuario_id` del pedido; pedidos de otro usuario en el estado.
- **Páginas (RTL, `renderApp`)**: acceso (anónimo → `/ingresar`), listado/paginación/vacío/error/`propios=true`, filtro por estado (aplicar, URL al recargar, vuelve a la página 1, combinado con paginación, «Limpiar filtro», vacío con filtro distinto del vacío sin pedidos), detalle con envío/retiro/ítems/totales, ajeno/404, progreso por estado, pago `MERCADOPAGO` (rechazado → «Reintentar el pago», aprobado, efectivo sin consulta), historial con «Vos»/«El local»/«Automático» y error aislado, polling (30 s; terminado no pide; oculta no pide; «Actualizar»), cancelación (motivo, vacío, doble clic, MP confirmado, 409, red + reintento, foco). axe en listado (con y sin filtro), detalle y diálogo con error. Regresión: tests de `pedido-creado`, `pago-pedido` y `gestion-pedidos` verdes tras los movimientos de D1, D11 y la generalización de D3.

## Risks / Trade-offs

- **R1 [FSM del cliente duplicada]** `puedeCancelarCliente` copia `fsm.py`. → Solo esconde; el 409 se muestra (D3); test de tabla con la fuente comentada (igual que C-22).
- **R2 [Motivo obligatorio solo en la UI]** Un cliente por API puede cancelar sin motivo y queda «Cancelado por el cliente». → Aceptado por la spec `order-api` (C-11); OQ-2 ofrece endurecerlo.
- **R3 [Polling]** Un cliente con un pedido abierto pide cada 30 s. → Solo pestaña visible y pedidos no terminados; WebSocket en C-27.
- **R4 [Generalizar la feature de C-22]** Tocar `useEnvioCambio`/`DialogoCancelarPedido` puede romper la gestión. → Red de seguridad con los tests de C-22 antes y después; el cambio es aditivo (parámetro con defecto `'gestion'`).
- **R5 [Cancelar un pedido Mercado Pago pagado]** No hay reintegro automático (KB/07 Flujo 7). → Aviso en el diálogo (D3); queda como pregunta abierta del dominio.
- **R6 [Envío de $ 50 en retiros]** Hallazgo de C-22 (deuda en C-25b): el cliente también lo ve en sus totales. → La UI muestra lo que devuelve el backend; no se corrige acá.
- **R7 [Filtro + actualización periódica]** Con «Pendiente» filtrado, un pedido que el local confirma desaparece del listado en la siguiente actualización. → Es lo que pidió el filtro (mismo comportamiento que gestión en C-22); el resumen y la paginación se recalculan con la respuesta.

## Migration Plan

Sin migraciones de base. El backend suma un query param opcional (por defecto el comportamiento actual). Frontend y backend se despliegan juntos en `dev`. Rollback: revertir el commit.

## Open Questions

> Governance MEDIO. Cada pregunta tiene una **propuesta por defecto** que ya reflejan specs, tareas y mockups; el usuario las confirma junto con la aprobación de mockups. Si alguna respuesta difiere, se ajustan specs, mockups y tareas antes de `/opsx:apply`.

- **OQ-1 — «Mis pedidos» de un usuario con rol de gestión (brecha backend).** Defecto: **filtro `propios=true`** en `GET /pedidos` que limita el listado a los pedidos del usuario aunque sea `ADMIN`/`PEDIDOS` (D2, spec `order-api`); la página siempre lo envía. Alternativa: no tocar backend y mostrar «Mis pedidos» solo a `CLIENT` (cambia la navegación de la spec del shell y un usuario `CLIENT`+`PEDIDOS` seguiría viendo todos los pedidos).
- **OQ-2 — Motivo obligatorio al cancelar.** Defecto: **obligatorio en la UI**; el backend sigue aceptando `DELETE` sin motivo con «Cancelado por el cliente» (spec `order-api` de C-11). Alternativa: que el backend responda 422 sin motivo (modifica la spec `order-api` y tests de C-11).
- **OQ-3 — Pago con Mercado Pago en el detalle.** Defecto: **mostrar la fila «Pago»** (pendiente/aprobado/rechazado con motivo/a devolver) y, si el pedido sigue pendiente sin pago en curso, **«Pagar con tarjeta» / «Reintentar el pago»** que lleva a la página de pago (D7). Alternativa: solo un enlace «Ver el pago» a la página de pago, sin consultar `/pagos` desde el detalle.
- **OQ-4 — Filtros en el listado.** Defecto propuesto: sin filtros. Alternativa: selector de estado como en gestión (el backend ya lo soporta) o pestañas «En curso / Todos» (requeriría filtro multi-estado en backend). **Respuesta: con filtro por estado** (ver resolución).
- **OQ-5 — Quién hizo cada cambio, visto por el cliente.** Defecto: **«Vos» / «El local» / «Automático»**, sin el nombre del personal (D8). Alternativa: mostrar el nombre del gestor como en la gestión.
- **OQ-6 — Forma del seguimiento.** Defecto: **barra de progreso de 5 pasos + línea «qué sigue» + historial** debajo (D6); en retiro, el paso 4 se llama «Listo para retirar». Alternativa: solo el historial (línea de tiempo de C-22) sin barra de pasos.

> **Resolución (2026-11-19, por el usuario):** OQ-1, OQ-2, OQ-3, OQ-5 y OQ-6 se aprueban con su **defecto** (D2, D3, D7, D8, D6). **OQ-4 cambia**: el listado **filtra por estado** con un `select` nativo («Todos» + los seis estados) como el de gestión de C-22, sin filtro de fecha; el estado vive en la URL (`?estado=`), cambiarlo vuelve a la página 1, «Limpiar filtro» cuando hay uno activo, y un vacío con filtro («No tenés pedidos en ese estado») distinto del vacío sin pedidos. Se mantienen el paginado de a 10 y la marca «En curso». Reflejado en D4, D9 (R7), D11, D10, la spec `frontend-my-orders` (requisito «Filtro por estado de mis pedidos»), las tareas 3.3 y 6.x y los mockups del listado (`?estado=filtro`, `?estado=filtro-vacio`). Backend: sin cambios extra (D2). Las OQ quedan cerradas; la aprobación de los mockups revisados sigue pendiente.

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-21-fe-mis-pedidos-seguimiento/mockups/`
- Approval: approved (2026-11-19, by user). Mockups revisados con el filtro por estado (OQ-4); OQ-1, OQ-2, OQ-3, OQ-5 y OQ-6 por defecto.
- Preview: rendered (2026-11-19, mockups/previews/ — 31 estados × 1440x900 y 390x844 = 62 capturas + 12 páginas completas en previews/full/; revisión por OQ-4: el listado suma el filtro por estado y se re-renderizaron solo sus capturas `mis-pedidos-*`, con las nuevas `mis-pedidos-filtro` y `mis-pedidos-filtro-vacio`; Edge headless + playwright-core desde file://, Playwright MCP sin Chrome en esta máquina; sin errores de consola, scroll horizontal ni diálogos recortados). Decisiones visuales a confirmar con los mockups: la tarjeta de acciones se titula «¿Cambiaste de idea?»; en mobile el progreso va en vertical y la tarjeta de acciones queda después del seguimiento.
- Visual verify: passed with differences (2026-11-19, app real con Edge headless a 1440x900 y 390x844; capturas en `mockups/verify/`). Un defecto mayor corregido (distintivos «Entregado» y «Confirmado» sin color por purga de Tailwind) y diferencias menores registradas en `## Verify`.

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844):

| Pantalla / estado | Notas |
|---|---|
| Listado con datos (varios estados y formas de pago, marca «En curso») | tabla en desktop, tarjetas en mobile; panel lateral del cliente con «Mis pedidos» activo |
| Listado con paginación (página 3 de 3) | |
| Listado con filtro «Entregado» (12 pedidos, página 1 de 2, «Limpiar filtro») | `?estado=ENTREGADO`; filtro visible en todos los estados del listado |
| Listado con filtro sin resultados («No tenés pedidos en ese estado» + «Limpiar filtro») | distinto del vacío sin pedidos |
| Listado cargando (primera vez) | skeleton |
| Listado vacío («Todavía no hiciste pedidos» + «Ver catálogo») | |
| Listado con error del servidor («Reintentar») | |
| Detalle `PENDIENTE` `EFECTIVO` (progreso en paso 1, «Cancelar pedido», historial de 1 evento) | dirección de entrega visible |
| Detalle `PENDIENTE` `MERCADOPAGO` con pago rechazado («Reintentar el pago») | |
| Detalle `CONFIRMADO` `MERCADOPAGO` con pago aprobado (cancelable) | historial con evento «Automático» |
| Detalle `EN_PREP` (no cancelable: explicación) con observación del local en el historial | marca de actualización |
| Detalle `EN_CAMINO` con envío y variante retiro («Listo para retirar») | |
| Detalle `ENTREGADO` (sin acciones ni marca de actualización) | |
| Detalle `CANCELADO` (banda con motivo, historial con cancelación resaltada) | |
| Detalle cargando, no encontrado/ajeno, error del detalle, historial con error aparte | |
| Indicador de actualización: «Actualizado a las HH:MM», «Actualizando…», aviso de actualización fallida | |
| Diálogo «Cancelar el pedido #58» vacío, con error «Escribí el motivo…», enviando | |
| Diálogo variante `CONFIRMADO` `MERCADOPAGO` (aviso de reintegro) | |
| Diálogo con error «Tu pedido ya avanzó…» y con error de conexión («Reintentar») | |
| Toast «Pedido #58 cancelado» sobre el detalle cancelado | |

## Desviaciones registradas durante apply

- `TraspasoPago.total` pasa a ser un texto ya formateado (`formatearPrecio` lo aplica la página): `entities/payment` no puede importar `entities/producto` (FSD). Se suma la prop `integrado` (clase `pcard-in`) para usarlo dentro de la tarjeta de seguimiento.
- `MarcaActualizacion` formatea la hora con una función local: `shared` no puede importar `entities`.
- Clases CSS del progreso renombradas `.prog-steps`/`.prog-next` (el mockup usaba `.steps`/`.next`, que chocan con clases existentes).
- `useCancelarMiPedido` reutiliza el tipo `CambioEstadoPedido` como variable de la mutación para que `useEnvioCambio` sirva a ambas.
- Textos de `queSigue` según D6 (no el sufijo del mockup); `AvisoActualizacionFallida` mantiene «los pedidos».
- El diálogo de cancelación lo monta `MiPedidoDetallePage` (estado `cancelando`), no el botón: si el detalle se vuelve a pedir y pasa a `EN_PREP` (409), el botón desaparece y el diálogo tiene que seguir visible para mostrar el rechazo. Al cerrarse, si ya no hay botón, el foco pasa al título.
- Unidades puras (`esEstadoPedido`, `puedeCancelarCliente`, `pasosProgreso`, `autorEventoCliente`): prueba e implementación se escribieron en el mismo paso y algunas pruebas de triangulación pasaron en verde en la primera ejecución.

## Verify

**Fecha:** 2026-11-19 · **Veredicto: PASS WITH FINDINGS** (un mayor corregido; sin bloqueantes abiertos).

**Pruebas:** frontend 159 archivos / 1627 tests (1621 antes del fix + 6 nuevos), `typecheck` y `lint` limpios; backend 1764 passed (un solo proceso); sin bytes NUL en archivos cambiados/nuevos. Reglas duras: router sin lógica (solo `filtros.py`/`service.py` tocan `propios`), sin `any`, imports FSD por API pública (page → feature, entities/shared sin imports hacia arriba), TanStack Query, errores por `code`, COCINA intacta. Cada requisito/escenario de las specs `frontend-my-orders`, `order-api` y `frontend-app-shell` tiene al menos un test (`mis-pedidos.test.tsx`, `mi-pedido-detalle*.test.tsx`, `cancelar-mi-pedido.test.tsx`, `*-actualizacion.test.tsx`, `filtro.test.ts`, `que-sigue.test.ts`, `rutas-mis-pedidos.test.tsx`, `test_pedidos_contrato.py`).

### Hallazgos

- **Mayor (corregido) — distintivos `Entregado` y `Confirmado` sin color.** `claseEstado` armaba `b-<estado>` con una plantilla; Tailwind solo conserva las reglas de `entities/pedido/ui/pedido.css` cuyas clases aparecen literales en `src`, y `b-entregado`/`b-confirmado` no aparecían, así que se purgaban (se veía un punto negro sin píldora en listado, detalle y también en gestión de C-22, heredado). Fix test-first: `frontend/tests/architecture/styles-compile.test.ts` (nuevo `it.each` por estado: RED en CONFIRMADO y ENTREGADO) y `frontend/src/entities/pedido/model/estados.ts` (`CLASES_ESTADO` con las clases literales). GREEN: 12/12 y suite completa verde.
- **Menor (no corregido) — la captura de página completa en desktop deja una franja bajo la barra lateral fija (artefacto de `fullPage`, no de la app).**
- **Menor (informativo) — `401 POST /auth/refresh` al abrir la app sin sesión (arranque anónimo, esperado) y `404 GET /pedidos/:id` + `/historial` al abrir un pedido ajeno/inexistente (la UI muestra «No encontramos este pedido»).** Sin otros errores de consola ni requests fallidas; sin scroll horizontal a 390 px en ninguna pantalla.
- **Diferencias de datos con el mockup (no defectos):** el mockup mostraba la dirección con «Timbre 2» y el texto «…cuando recibe el pago en efectivo»; la app usa los datos reales y el texto de D6 («…cuando recibe el pago»), ya registrado en «Desviaciones».

### Pantallas

Comprobadas (1440x900 y 390x844, comparadas con `mockups/previews/`): listado con datos (15 pedidos, «En curso»), página 2 (11–15 de 15), filtro «Entregado» (URL `?estado=`, recarga conserva el filtro, «Limpiar filtro» vuelve a `/mis-pedidos`, cambiar el filtro desde la página 2 vuelve a la 1), filtro sin resultados y vacío sin pedidos (usuario PEDIDOS sin pedidos propios: OQ-1, y el detalle de un pedido ajeno también dice «No encontramos este pedido»), detalle PENDIENTE EFECTIVO (retiro), PENDIENTE MERCADOPAGO (fila «Pago»: «Pago en confirmación» + «Ver el estado del pago»), CONFIRMADO MERCADOPAGO (pago aprobado, historial «El local»/«Vos»), EN_PREP (sin cancelar, con explicación), EN_CAMINO con envío, retiro (paso 4 «Listo para retirar»), ENTREGADO, CANCELADO por el local y por mí («Lo cancelaste…», autor «Vos»), no encontrado y ajeno (otro cliente), diálogo de cancelación vacío / sin motivo (error + foco al campo) / variante Mercado Pago (aviso de reintegro) / éxito con toast; cancelación real de #11 (desktop) y #9 (mobile): detalle, historial y listado «Cancelado» actualizados. Foco devuelto a «Cancelar pedido» al cerrar con Escape. C-22: `/gestion-pedidos` (lista, filtro por URL), detalle y diálogo «Cancelar el pedido #16» siguen igual tras los movimientos compartidos.

No comprobadas en la app real (cubiertas solo por tests RTL): «Reintentar el pago» / «Pagar con tarjeta» (no hay pedido MP rechazado o sin intento en la base de desarrollo y no se hicieron pagos), skeleton de carga, error del servidor del listado/detalle, historial con error, indicador «Actualizando…», aviso de actualización fallida, diálogo con error de transición/conexión, refresco automático a los 30 s.
