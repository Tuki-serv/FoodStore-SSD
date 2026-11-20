# Proposal — C-22 `fe-gestion-operativa-pedidos`

## Why

US-020, US-021 y US-022 (Épica 5) piden que el local opere los pedidos: verlos todos con filtros, consultar su historial, confirmar a mano los de efectivo/transferencia, avanzarlos por la FSM hasta la entrega (incluido el despacho `EN_CAMINO`, DD-23) y cancelarlos con motivo. Hoy el backend ya lo permite (C-09, C-10, C-11), pero en el frontend `/gestion-pedidos` es una **página provisoria** con dueño `C-22`: los pedidos que crean C-19/C-20 quedan `PENDIENTE` sin que nadie del local pueda confirmarlos desde la UI. Es la pieza que cierra el circuito operativo y desbloquea C-24 (dashboard).

Observado en el repo (`dev`, 2026-11-19):

- **Listado** `GET /api/v1/pedidos` (`backend/app/modules/pedidos/router.py:41-49`): `CLIENT`/`ADMIN`/`PEDIDOS`; gestores ven todos (`service.py:398-408`, `ROLES_GESTORES`); filtros `estado` (uno solo, `Literal` de los seis códigos), `desde`/`hasta` inclusivos sobre `created_at` **en UTC** (`filtros.py:9-14`, `repository.py:39-46`); orden más nuevo primero; paginado `page`/`size` (20 por defecto, máx. 100). Cada ítem trae `cliente_nombre`, sin líneas.
- **Detalle** `GET /pedidos/{id}` (`router.py:52-59`): campos del listado + `direccion_id` + `items`. **No trae la dirección**: y `GET /direcciones/{id}` es solo del dueño (`direcciones/service.py:26-29`, 403 para otro usuario), así que un gestor **no puede ver a dónde despachar**.
- **Historial** `GET /pedidos/{id}/historial` (`router.py:62-69`): filas `{estado_desde, estado_hacia, motivo, usuario_id, created_at}` en orden ascendente; **sin nombre de quien hizo el cambio** (`schemas.py:13-20`); `usuario_id` nulo = Sistema.
- **Cambio de estado** `PATCH /pedidos/{id}/estado` `{nuevo_estado, motivo}` (`router.py:72-89`): FSM por unión de roles (`fsm.py:32-62`): gestores PENDIENTE→CONFIRMADO (solo `EFECTIVO`/`TRANSFERENCIA`), CONFIRMADO→EN_PREP, EN_PREP→EN_CAMINO, EN_CAMINO→ENTREGADO y CANCELADO desde PENDIENTE/CONFIRMADO/EN_PREP. Errores: 409 `INVALID_TRANSITION` (incluye «Un pedido MERCADOPAGO se confirma con el pago aprobado»), 409 `INSUFFICIENT_STOCK` «No hay stock suficiente para X» al confirmar sin stock (`service.py:227-228`, DD-20), 422 `field: motivo` si se cancela sin motivo (`schemas.py:78-84`).
- **Baja**: `DELETE /pedidos/{id}` es solo `CLIENT` (`router.py:92`); la spec `order-api` dice «Los pedidos no se borran por API». RN-PE-12 (KB/05) dice «Solo ADMIN puede eliminar (soft delete)»: contradicción documentada (OQ-4).
- **Frontend**: `entities/pedido` (C-19/C-20b) con tipos, `pedidoQueries.todas()/detalle(id)`, `BadgeEstado`, `etiquetaEstado`, `EtiquetaFormaPago`, `FORMAS_PAGO`, `esConfirmacionManual`; sin listado, historial ni cambio de estado. Ruta `/gestion-pedidos` con acceso `PEDIDOS`/`ADMIN` y sección en el panel lateral (C-13a, DD-25). Patrón de listado con filtros en la URL en `pages/admin-productos/model/filtro.ts`. Polling con `refetchInterval` ya usado en `pages/pago-pedido` (C-20b).

## What Changes

- **Gestión de pedidos** (`/gestion-pedidos`, `PEDIDOS`/`ADMIN`): listado paginado de todos los pedidos (número, fecha y hora, cliente, forma de pago, total, estado), filtros por estado y rango de fechas guardados en la URL, actualización automática cada 30 s mientras la pestaña está visible (sin WebSocket: C-27 está diferida) más «Actualizar» manual, y por fila la **próxima acción** de la FSM.
- **Detalle operativo** (`/gestion-pedidos/:pedidoId`): datos del pedido, cliente, entrega (dirección o retiro), ítems con personalización, totales, notas, **historial** como línea de tiempo (estado, quién —o «Sistema»—, cuándo, motivo) y las **acciones visibles según FSM, rol y forma de pago**.
- **Acciones**: «Confirmar pago» (PENDIENTE→CONFIRMADO, solo `EFECTIVO`/`TRANSFERENCIA`, DD-22; en `MERCADOPAGO` se explica que se confirma solo con el pago aprobado), «Pasar a preparación», «Despachar» (EN_CAMINO, DD-23), «Marcar entregado», todas con observación opcional; «Cancelar pedido» con motivo obligatorio (desde PENDIENTE/CONFIRMADO/EN_PREP). Errores mostrados por `code`: sin stock al confirmar (DD-20) con la salida «Cancelar por falta de stock», transición ya no válida (otro gestor lo movió) con recarga, motivo faltante.
- **`entities/pedido` ampliada y reutilizable por C-21**: listado con filtros, historial, cambio de estado, línea de tiempo del historial y el espejo de la FSM para la UI.
- **Backend (aditivo, sin migración; ver OQ-2/OQ-3)**: el detalle de un pedido suma `direccion` (resumen de la dirección de entrega, o `null`) y cada fila del historial suma `usuario_nombre` (`null` para el Sistema). Con TDD en pytest contra PostgreSQL.
- **Docs al cerrar**: KB/06 (US-020..US-022 marcadas), `frontend/README.md`, `CHANGES.md` (cierre de C-22, «Punto de partida (C-22)» en C-21 y C-24).

**Fuera de alcance (con dueño):** «Mis pedidos» del cliente y su cancelación (C-21); WebSocket/KDS y rol `COCINA` (C-26/C-27, PA-07: no se agrega ni se quita nada de `COCINA`); estado del pago de Mercado Pago dentro de la gestión (PEDIDOS no lee `/pagos`); borrado de pedidos (OQ-4); filtro por varios estados o por cliente, y fechas en hora local (OQ-7, deuda para C-25b); dashboard (C-24).

## Capabilities

### New Capabilities
- `frontend-order-management`: gestión operativa de pedidos en el frontend para `PEDIDOS`/`ADMIN` — acceso, listado con filtros y actualización periódica, detalle con historial, acciones según FSM/rol/forma de pago, confirmación manual, despacho, entrega, cancelación con motivo y manejo de errores.

### Modified Capabilities
- `order-api`: el detalle de un pedido incluye el resumen de la dirección de entrega y el historial incluye el nombre de quien hizo cada cambio.

## Impact

- **Frontend nuevo** (`frontend/src/`): `pages/gestion-pedidos/` (listado, filtros, detalle, estados de carga/vacío/error, CSS), `features/cambiar-estado-pedido/` (diálogo de avance/confirmación/cancelación y mutación), ampliación de `entities/pedido/` (`api/`: `listarPedidos`, `obtenerHistorial`, `cambiarEstadoPedido`, `pedidoQueries.lista/historial`; `model/`: filtros, `accionesGestion`, `clasificarErrorCambioEstado`, tipos `PedidoResumen`, `EventoHistorial`, `DireccionPedido`; `ui/`: `LineaTiempoHistorial`), handlers MSW en `test/msw/pedidos.ts`.
- **Frontend modificado**: `shared/config/routes.ts` (`RUTA_GESTION_PEDIDO`, `rutaGestionPedido`), `app/router/routes.tsx` (página real en `/gestion-pedidos` y detalle), `app/router/route-map.ts` (C-22 deja de ser dueño de una provisoria), `app/styles/index.css`.
- **Backend modificado** (si OQ-2/OQ-3 se aprueban): `modules/pedidos/schemas.py` (`DireccionPedidoRead`, `PedidoDetalle.direccion`, `HistorialEstadoPedidoRead.usuario_nombre`), `service.py` (`_armar_detalle`, `obtener_historial`), `repository.py` (historial con nombre del usuario en un JOIN), tests en `backend/tests/integration/test_pedidos_contrato.py`. Sin cambios de esquema ni de rutas.
- **Paquetes**: ninguno nuevo. **Dependencias**: C-13b, C-09, C-11 (cerrados); reutiliza C-19/C-20b (`entities/pedido`).
- **Governance MEDIO**: checkpoints por bloque; gate de mockups aprobados antes de `/opsx:apply` (`[UI-MOCKUP]`, política `system-and-mockups`).
