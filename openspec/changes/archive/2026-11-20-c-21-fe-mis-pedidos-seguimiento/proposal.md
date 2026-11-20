# Proposal — C-21 `fe-mis-pedidos-seguimiento`

## Why

US-018 y US-019 (Épica 4) piden que el cliente vea sus pedidos, siga en qué estado está cada uno y pueda cancelarlo mientras todavía no se empezó a preparar. Hoy `/mis-pedidos` es una **página provisoria** con dueño `C-21`, aunque la confirmación del pedido (C-19) y la página de pago (C-20b) ya mandan ahí («Ver mis pedidos»): después de comprar, el cliente no tiene dónde ver su pedido ni cancelarlo. C-22 dejó en `entities/pedido` casi todo lo necesario (listado paginado, historial, línea de tiempo, entrega, distintivos), así que este change es chico: arma las dos pantallas del cliente y la cancelación propia sobre esas piezas.

Observado en el repo (`dev`, 2026-11-19):

- **Listado** `GET /api/v1/pedidos` (`backend/app/modules/pedidos/router.py:41-49`): un `CLIENT` ve solo los suyos (`service.py:401-411`, `alcance = usuario_id` si no es gestor), paginado `page`/`size` y filtros `estado`/`desde`/`hasta`. **Brecha**: con `ADMIN` o `PEDIDOS` el alcance es «todos» (`service.py:405`; spec `order-api` «Unión de CLIENT y PEDIDOS»), y la navegación muestra «Mis pedidos» también a esos roles (spec `frontend-app-shell`, `ACCESO_RUTAS[misPedidos] = 'sesion'` en `frontend/src/shared/config/routes.ts:53`): sin un filtro, «Mis pedidos» de un gestor listaría los pedidos de todos los clientes (OQ-1).
- **Detalle** `GET /pedidos/{id}` (`router.py:52-59`): el dueño lo ve con `direccion` e `items` (C-22, `schemas.py:121-125`); un gestor ve cualquiera, así que la UI de «Mis pedidos» tiene que comprobar que el pedido es del usuario.
- **Historial** `GET /pedidos/{id}/historial` (`router.py:62-69`): el dueño lo ve, con `usuario_nombre` (C-22, `service.py:195-204`).
- **Cancelación del cliente** `DELETE /pedidos/{id}` (`router.py:92-101`): solo `CLIENT`, solo el dueño (403, `service.py:427-428`), FSM del cliente PENDIENTE/CONFIRMADO → CANCELADO (`fsm.py:48-50`; 409 `INVALID_TRANSITION` desde EN_PREP), devuelve stock solo si estaba CONFIRMADO/EN_PREP (`service.py:45, 327-328`, RN-ST-02). El body `{motivo}` es **opcional**: vacío → «Cancelado por el cliente» (`service.py:424`, spec `order-api` «DELETE cancela el pedido propio»). US-019 lo pide obligatorio (OQ-2).
- **Pago** `GET /pagos/{pedido_id}` (`pagos/router.py:103`): el dueño lo lee (C-04, `pagos/service.py:71-76`); la confirmación (C-19/C-20b) ya muestra «Pago» y el traspaso «Pagar con tarjeta» con componentes propios de `pages/pedido-creado/ui/` (`estado-pago.tsx`, `traspaso-pago.tsx`).
- **Frontend**: `entities/pedido` (C-19/C-20b/C-22) con `pedidoQueries.lista/detalle/historial`, `LineaTiempoHistorial`, `autorEvento`, `EntregaDelPedido`, `BadgeEstado`, `EtiquetaFormaPago`, `fechaHoraCorta`, `clasificarErrorCambioEstado`, `transiciones.ts` (FSM de gestión); `features/cambiar-estado-pedido` (diálogos y envío por `PATCH /estado`, solo gestores); `shared/ui` con `Dialogo`, `DialogoBaja` (con `children`), `Paginacion`, `estados`. Polling con `refetchInterval` ya usado en `gestion-pedidos` y `pago-pedido`.

## What Changes

- **Mis pedidos** (`/mis-pedidos`, con sesión): listado paginado de los pedidos propios, del más nuevo al más viejo (número, fecha y hora, forma de pago, total y estado; el listado del backend no trae ítems), filtro por estado («Todos» + los seis estados, OQ-4 resuelta), filtro y página en la URL, estados de carga/vacío («Todavía no hiciste pedidos» + «Ver catálogo»)/vacío con filtro («No tenés pedidos en ese estado» + «Limpiar filtro»)/error, y actualización cada 30 s con la pestaña visible mientras haya algún pedido en curso en la página.
- **Detalle y seguimiento** (`/mis-pedidos/:pedidoId`): progreso del pedido (Pendiente → Confirmado → En preparación → En camino → Entregado, o banda de «Cancelado» con el motivo), qué falta según la forma de pago (confirmación manual del local o pago con Mercado Pago), entrega, ítems con personalización, totales, notas y el **historial** como línea de tiempo; se actualiza cada 30 s mientras el pedido no esté terminado (WebSocket queda en C-27). Un pedido ajeno o inexistente muestra «No encontramos este pedido».
- **Cancelar mi pedido** (US-019): «Cancelar pedido» solo en PENDIENTE/CONFIRMADO, diálogo con **motivo obligatorio** (máx. 300), aviso de que no se deshace y, si estaba CONFIRMADO con Mercado Pago, que el reintegro no es automático; envía `DELETE /pedidos/{id}` con `{motivo}`. Errores por `code`: el pedido ya avanzó (409) con recarga del estado real, sin conexión con «Reintentar», 403/404.
- **Estado del pago** en el detalle de pedidos `MERCADOPAGO` (OQ-3): la fila «Pago» y, si está pendiente sin intento en curso, «Pagar con tarjeta»/«Reintentar el pago»; los componentes salen de `pages/pedido-creado` a `entities/payment/ui` para reutilizarlos sin cruzar páginas.
- **Backend (aditivo, sin migración; OQ-1)**: `GET /pedidos?propios=true` limita el listado a los pedidos del usuario aunque tenga roles de gestión. TDD en pytest contra PostgreSQL.
- **Reutilización de C-22**: listado, historial y línea de tiempo de `entities/pedido` (con el autor adaptado al cliente, OQ-5), clasificador de errores y diálogo de cancelación de `features/cambiar-estado-pedido` en una variante para el cliente.
- **Docs al cerrar**: KB/06 (US-018/US-019 marcadas), KB/07 Flujo 7, `frontend/README.md`, `CHANGES.md` (cierre de C-21 y nota en C-27).

**Fuera de alcance (con dueño):** WebSocket del seguimiento (C-27, bloqueado por PA-07); reintegro automático de Mercado Pago (pregunta abierta de KB/07); filtro por fecha en «Mis pedidos» (OQ-4: solo por estado); repetir un pedido; gestión de pedidos (C-22, cerrado); nada de `COCINA` (PA-07).

## Capabilities

### New Capabilities
- `frontend-my-orders`: «Mis pedidos» del cliente en el frontend — acceso, listado paginado propio filtrable por estado, detalle con progreso, estado del pago y historial, actualización periódica, cancelación con motivo y manejo de errores.

### Modified Capabilities
- `order-api`: el listado acepta el filtro `propios` que limita el resultado a los pedidos del usuario aunque tenga roles de gestión.
- `frontend-app-shell`: `/mis-pedidos` deja de ser página provisoria; el ejemplo de página provisoria del mapa de rutas pasa a otra ruta pendiente.

## Impact

- **Frontend nuevo** (`frontend/src/`): `pages/mis-pedidos/` (`MisPedidosPage`, `MiPedidoDetallePage`, tarjetas/tabla del listado, `ProgresoPedido`, `AccionesMiPedido`, CSS; `model/` con lectura de `page` y la regla de polling), `entities/payment/ui/` (`LineaEstadoPago`, `PagoEnConfirmacion`, `TraspasoPago` movidos), en `entities/pedido`: `cancelarMiPedido` (API), `puedeCancelarCliente` y `pasosProgreso` (modelo, en `transiciones.ts`), `autorEventoCliente`; en `features/cambiar-estado-pedido`: `CancelarMiPedido` (botón + diálogo, `DELETE`).
- **Frontend modificado**: `shared/config/routes.ts` (`RUTA_MI_PEDIDO`, `rutaMiPedido`), `app/router/routes.tsx` (páginas reales), `app/router/route-map.ts` y su test, `pages/pedido-creado` (importa los componentes de pago movidos), `entities/pedido/ui/linea-tiempo-historial.tsx` (autor configurable), `test/msw/pedidos.ts` (`DELETE` y `propios`), `app/styles/index.css`.
- **Backend modificado** (OQ-1 aprobada): `modules/pedidos/filtros.py` (`propios`), `service.py` (`listar_pedidos` respeta `propios`), tests en `backend/tests/integration/test_pedidos_multirol.py` o archivo nuevo. Sin cambios de esquema, rutas ni permisos.
- **Paquetes**: ninguno nuevo. **Dependencias**: C-19, C-11 (cerrados); reutiliza C-20b y C-22.
- **Governance MEDIO**: checkpoints por bloque; gate de mockups aprobados antes de `/opsx:apply` (`[UI-MOCKUP]`, política `system-and-mockups`).
