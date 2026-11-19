# Design — C-20b `fe-pago-seguimiento`

## Context

C-20 se partió en dos (OQ-5, 2026-11-19). **C-20a** `fe-pago-tarjeta` entrega la página de pago (`/finalizar-compra/pedido/:pedidoId/pago`) con el brick `CardPayment`, el resultado inmediato de `POST /pagos/crear`, el reintento, `a_devolver`, los errores y el endpoint `GET /api/v1/pagos/config`. Su vista sale de `vistaPago(pedido, pago)` sobre la caché `['pagos', pedidoId]` de `pagoQueries.estado`, que en C-20a solo se llena con la respuesta de `crear` o tras un 409. El webhook (C-05/C-12) confirma el pago de forma asíncrona y deja el estado terminal en la base; no hay retorno por redirect (DD-21).

**C-20b** (este change) agrega lo que depende de leer el estado del servidor a lo largo del tiempo: la consulta al montar (recarga), el polling del pendiente y el estado del pago en la confirmación del pedido.

Restricciones: governance CRÍTICO, FSD con imports hacia abajo, server state en TanStack Query, TS `strict` sin `any`, Strict TDD.

## Goals / Non-Goals

**Goals**
- Recargar la página de pago muestra el resultado real del último intento.
- Un pago `pendiente` pasa solo a aprobado/rechazado/`a_devolver` cuando llega el webhook, con tope de espera.
- La confirmación del pedido muestra el estado del pago con motivo legible (US-026).

**Non-Goals**
- Todo lo de C-20a (brick, envío, errores de `crear`, endpoint de configuración).
- WebSocket (C-27) como reemplazo del polling.
- Listado «Mis pedidos» y timeline (C-21).
- Cambios de backend.

## Decisions

### D1 — Consulta al montar
`PagoPedidoPage` habilita `pagoQueries.estado(id)` en cuanto el pedido cargó y es `MERCADOPAGO` (`enabled: pedido?.forma_pago_codigo === 'MERCADOPAGO'`). Mientras esa consulta carga se muestra el mismo indicador de carga de la página (no se monta el brick antes de saber si ya hay un pago aprobado o pendiente). `vistaPago` no cambia: con el pago leído, la tabla de C-20a (D4) ya da aprobado, rechazado, pendiente o `a-devolver`. Un error de la consulta (red/5xx) muestra «No pudimos conectarnos…» con «Reintentar», sin montar el brick.

### D2 — Polling del pendiente — *confirmar en OQ-2*
`pagoQueries.estado` con `refetchInterval` de **5 s** mientras la vista es `pendiente`, hasta **2 min** desde que se entró en pendiente (marca de tiempo en estado local de la página); luego `refetchInterval: false` y la vista «La confirmación está demorando» con «Actualizar» (`refetch`) y «Ver mi pedido». Al llegar a un estado terminal se corta el polling y la página invalida `pedidoQueries.detalle(id)` y `pedidoQueries.todas()` (la invalidación del pedido la hace la página, como en C-20a, para no cruzar slices). `refetchIntervalInBackground: false` (no consulta con la pestaña oculta). Tests con timers falsos de Vitest.

### D3 — Estado del pago en la confirmación — *confirmar en OQ-7*
En `pages/pedido-creado`, solo para pedidos `MERCADOPAGO`, se consulta `pagoQueries.estado(id)` (importado de `@/entities/payment`, capa inferior) y se muestra una línea:

| Último intento | Línea | CTA «Pagar $ X con tarjeta» |
|---|---|---|
| sin intentos | — | sí (si el pedido está `PENDIENTE`) |
| `rechazado` | «Último intento de pago: rechazado» + `motivoRechazo(detalle)` | sí (si `PENDIENTE`) |
| `pendiente` | «Pago en confirmación» | no |
| `aprobado` | «Pago aprobado» | no |
| `a_devolver` | «Pago aprobado, a devolver» | no |

Sin polling en la confirmación (el cliente puede ir a la página de pago, que sí sigue el pendiente). Pedidos `EFECTIVO`/`TRANSFERENCIA` no consultan `/pagos`.

### D4 — Tests (Strict TDD)
- Página de pago con RTL + MSW (`onUnhandledRequest: 'error'`) y el doble de `@mercadopago/sdk-react` de C-20a: recarga (aprobado, rechazado con motivo, pendiente, `EFECTIVO` sin consulta), polling con `vi.useFakeTimers({ shouldAdvanceTime: true })` contando requests (pendiente → aprobado/rechazado/`a_devolver`, tope a los 2 min, «Actualizar»).
- Confirmación (`pedido-creado`): una prueba por fila de D3 y la ausencia de consulta para `EFECTIVO`.

## Risks / Trade-offs

- **Polling**: carga extra acotada (≤ 24 consultas por pago pendiente) y solo con la pestaña visible.
- **Timers falsos con TanStack Query**: pueden volver frágiles los tests → se usan `shouldAdvanceTime` y `advanceTimersByTimeAsync`, y se cuenta requests en MSW en lugar de asertar llamadas internas.
- **Webhook que nunca llega** (ngrok caído en desarrollo): lo cubre el tope + «Actualizar»; el pedido queda `PENDIENTE` y el cliente puede verlo luego en «Mis pedidos» (C-21).

## Migration Plan

Sin migraciones ni cambios de backend ni dependencias. Rollback: deshabilitar la consulta al montar y el `refetchInterval` (vuelve el comportamiento de C-20a) y quitar la línea de estado en `pedido-creado`.

## Open Questions

- **OQ-2** Polling de pendiente: ¿5 s durante 2 min (defecto) u otros valores?
- **OQ-7** ¿Mostrar el estado del pago (`mp_status_detail` legible) también en la confirmación `/finalizar-compra/pedido/:id` para pedidos `MERCADOPAGO` (US-026)? Defecto: sí, una línea según D3 y el CTA «Pagar» se mantiene mientras el pedido siga `PENDIENTE` y el pago no esté `pendiente` ni `aprobado`.

(OQ-1, OQ-3, OQ-4, OQ-5 y OQ-6 se respondieron en C-20a el 2026-11-19.)

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: pendiente
- Approval: pending
- Preview: pendiente

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844): página de pago cargando el estado del pago (recarga), pendiente con seguimiento (esperando), «La confirmación está demorando» con «Actualizar», y la confirmación del pedido con cada línea de D3 (rechazado con motivo + CTA, pago en confirmación sin CTA, pago aprobado, a devolver). Los estados de la página de pago ya aprobados en C-20a se reutilizan sin cambios.
