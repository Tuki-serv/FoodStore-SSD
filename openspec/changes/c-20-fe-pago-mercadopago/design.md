# Design — C-20 `fe-pago-mercadopago`

## Context

C-19 crea el pedido y, si es `MERCADOPAGO`, lleva al cliente a `/finalizar-compra/pedido/:pedidoId/pago` (hoy `PlaceholderPage`). El backend de cobro (C-12, Orders API, DD-26) está cerrado: `POST /pagos/crear` devuelve el resultado inmediato (aprobado/rechazado/pendiente/`a_devolver`) y `GET /pagos/{pedido_id}` el último intento; el webhook confirma de forma asíncrona y deja el mismo estado en la base. No hay retorno por redirect (DD-21). El frontend no tiene el SDK de MercadoPago ni la clave pública configurada; `paymentStore` (C-13b) existe pero con `mpPaymentId: number` (desactualizado).

Restricciones: governance CRÍTICO, PCI SAQ-A (los datos de tarjeta solo en el brick), FSD con imports hacia abajo, server state en TanStack Query y client state en Zustand, TS `strict` sin `any`, Strict TDD.

## Goals / Non-Goals

**Goals**
- Página de pago real con `CardPayment`, envío del cuerpo exacto de `CrearPagoRequest`, vistas de resultado derivadas del servidor (recarga segura), reintento, polling de pendiente, caso `a_devolver` (DD-20) y errores 409/400/502/503/red.
- Configuración de la clave pública sin secretos en el frontend.

**Non-Goals**
- Cambios de backend (contrato de C-12 tal cual), salvo OQ-1 = endpoint.
- Otros medios (Rapipago, Pago Fácil, cuenta MP), challenge 3DS (`action_required`) y Checkout Pro (DD-21).
- Reembolsos/cancelación de pagos (PA-08) y WebSocket (C-27).
- Listado «Mis pedidos» y timeline (C-21); acá solo se enlaza.

## Decisions

### D1 — Ruta y guarda
Se reutiliza `RUTA_PAGO_PEDIDO` (`/finalizar-compra/pedido/:pedidoId/pago`) y `ACCESO_CLIENTE`; en `app/router/routes.tsx` se reemplaza `<PlaceholderPage title="Pago" owner="C-20" />` por `<PagoPedidoPage />`. El resultado se muestra **en la misma ruta** (sin `/pago/resultado`): la vista sale del estado del servidor, así recargar o volver con el historial no rompe nada.

### D2 — Ubicación FSD
- `entities/payment`:
  - `api/`: `pagoQueries.estado(pedidoId)` (`['pagos', pedidoId]`, `GET /pagos/{pedido_id}`), `useCrearPago()` (mutación `POST /pagos/crear`; en `onSuccess` escribe la respuesta en la caché de `pagoQueries.estado` e invalida `pedidoQueries.detalle(id)` y `pedidoQueries.todas()` cuando el estado es terminal). Para no importar `entities/pedido` desde `entities/payment` (import cruzado entre slices), la invalidación del pedido la hace la **página** en el `onSuccess` de la llamada, o se usa el patrón `@x` si el linter `fsd-boundaries` lo exige (se decide en apply sin cambiar comportamiento).
  - `model/`: tipos (`PagoEstado`, `CrearPagoBody`, `RespuestaCrearPago`), `cuerpoDesdeBrick(pedidoId, datos, additional)` (pura), `vistaPago(pedido, pago)` (pura, D4), `motivoRechazo(detalle)` (pura, D5), `clasificarErrorPago(error)` (pura, D7); `paymentStore` ajustado (D8).
- `features/pagar-con-tarjeta/`: `<FormularioTarjeta pedidoId monto onPagado />` que envuelve `initMercadoPago` + `CardPayment` del SDK, maneja `onReady`/`onError`/`onSubmit`, el estado procesando y el reintento (remontar con `key`). Es el **único** módulo que importa `@mercadopago/sdk-react`.
- `pages/pago-pedido/`: `PagoPedidoPage` compone pedido + pago + feature y renderiza la vista de D4.

### D3 — Clave pública — *confirmar en OQ-1*
Por defecto: variable de frontend `VITE_MP_PUBLIC_KEY`, **opcional** (`AppConfig.mpPublicKey: string | null`, recortada; vacía → `null`). No rompe el arranque (DD-18 sigue: sin default oculto, la ausencia es explícita y la página lo informa). `initMercadoPago(clave, { locale: 'es-AR' })` se llama una sola vez, perezosamente, al montar el formulario. Alternativa: endpoint público `GET /api/v1/pagos/config` que devuelva `MP_PUBLIC_KEY` del backend (una sola fuente de credenciales, pero agrega backend + tests pytest). La clave pública no es secreta; el access token y el secreto del webhook nunca llegan al frontend.

### D4 — Vista derivada (`vistaPago`)
Función pura sobre `(pedido: {forma_pago_codigo, estado_codigo}, pago: {estado} | null)` → una de:

| Condición | Vista |
|---|---|
| pago `aprobado` | `aprobado` |
| pago `a_devolver` | `a-devolver` |
| pago `pendiente` | `pendiente` |
| forma ≠ `MERCADOPAGO` | `no-tarjeta` |
| pedido ≠ `PENDIENTE` (sin aprobado/a_devolver) | `no-pagable` |
| pago `rechazado` y pedido `PENDIENTE` | `rechazado` (formulario + motivo) |
| sin intentos y pedido `PENDIENTE` | `formulario` |

El orden de la tabla es la precedencia. La respuesta de `crear` se escribe en la caché de `pagoQueries.estado` (`setQueryData`), así la vista cambia sin otra consulta.

### D5 — Motivo del rechazo
`motivoRechazo(detalle)` mapea un conjunto chico de detalles conocidos a textos en voseo (fondos insuficientes, datos de la tarjeta, código de seguridad, vencimiento, rechazo del emisor/llamar para autorizar, monto no admitido, duplicado) y devuelve el genérico para el resto o `null`. Como Orders y Payments usan nombres distintos (`insufficient_amount` vs `cc_rejected_insufficient_amount`), se aceptan ambas variantes; la tabla final se ajusta con lo observado en sandbox (`FUND`, `OTHE`; pendiente de verificar en C-12, OQ-14) — *confirmar en OQ-6*.

### D6 — Polling de pendiente — *confirmar en OQ-2*
`pagoQueries.estado` con `refetchInterval` de **5 s** mientras la vista es `pendiente`, hasta **2 min** desde que se entró en pendiente; luego `refetchInterval: false` y la vista «La confirmación está demorando» con «Actualizar» (`refetch`). Al llegar a un estado terminal se corta el polling e invalida el pedido. Tests con timers falsos de Vitest.

### D7 — Errores (`clasificarErrorPago`)
Sobre `ApiError` (`@/shared/api`): 409 → `no-permitido` (refetch de pedido y pago; la vista final la decide D4); 400 → `rechazado-datos` (vista rechazado con motivo genérico; el backend ya marcó el intento `rechazado`); 502 → `desconocido` (el token de tarjeta es de un solo uso: «Reintentar» remonta el brick para tokenizar de nuevo y el backend reutiliza el intento y su `X-Idempotency-Key`, sin cobrar dos veces); 503 → `no-disponible`; `status: null`/5xx → `conexion`; 401 lo resuelve el interceptor; 403/404 → «No encontramos este pedido». Los textos de cada clase están en la spec.

### D8 — `paymentStore`
Se mantiene solo en memoria, sin datos de tarjeta. Cambios: `mpPaymentId: string | null`, `ResultadoPago.estado` admite `a_devolver`, y `EstadoPago` agrega `a_devolver`. Uso: marcar `procesando` entre `onSubmit` y la respuesta para bloquear el doble envío aunque el brick se re-renderice; el resultado **de verdad** vive en la caché de TanStack Query (regla 8). Si en apply el `isPending` de la mutación alcanza para todo, se reporta la opción de retirar el store (no se retira sin OK).

### D9 — Formato del monto
`initialization.amount` del brick es `number`: se convierte desde el `total` decimal en texto (`"2850.00"` → `2850`) con el helper de centavos existente (sin floats intermedios para comparar). El monto que cobra el backend sale del pedido, no del frontend: el valor del brick solo es informativo/cuotas.

### D10 — Pagador
Por defecto **no** se precarga el email en el brick: en sandbox el pagador debe ser un comprador de prueba distinto del usuario de Food Store, y precargarlo ocultaría el campo — *confirmar en OQ-3*.

### D11 — Tests (Strict TDD)
- Unitarios puros: `cuerpoDesdeBrick`, `vistaPago`, `motivoRechazo`, `clasificarErrorPago`, `readConfig` (clave pública), `paymentStore`.
- Feature/página con RTL + MSW (`onUnhandledRequest: 'error'`). El SDK se reemplaza con `vi.mock('@mercadopago/sdk-react')` por un doble que expone botones «Simular pago» que invocan `onSubmit` con datos fijos, y `onReady`/`onError` (es un módulo de terceros, no propio; nunca se mockean módulos propios).
- Casos: aprobado, rechazado + reintento, 400, pendiente → aprobado/rechazado por polling, tope de espera, `a_devolver`, 409/502/503/red, no-tarjeta, no-pagable, 404, sin clave pública, recarga (estado inicial desde `GET /pagos`), cuerpo exacto del POST, doble envío.

## Risks / Trade-offs

- **SDK de terceros en tests**: el doble del brick no prueba el iframe real → se cubre con la prueba manual en sandbox (verify) y la referencia `sandbox/pago-prueba.html` de C-12.
- **Token de un solo uso**: un reintento tras 502 obliga a reingresar la tarjeta; aceptable y seguro.
- **Polling**: carga extra acotada (≤ 24 consultas por pago pendiente).
- **Doble cobro**: lo evita el backend (idempotencia por intento + webhook `a_devolver`); el frontend solo bloquea el doble envío.
- **Clave pública en `.env` del frontend**: duplicada respecto de `MP_PUBLIC_KEY` del backend (OQ-1).
- **Nombres de `status_detail` de Orders** no verificados para todos los casos → genérico como red de seguridad.

## Migration Plan

Sin migraciones ni cambios de backend. Instalar `@mercadopago/sdk-react` (versión exacta), agregar `VITE_MP_PUBLIC_KEY` a `frontend/.env.example` (placeholder) y documentar en el README de frontend. Rollback: volver a la `PlaceholderPage` en `routes.tsx`.

## Open Questions

- **OQ-1** Clave pública: ¿`VITE_MP_PUBLIC_KEY` opcional en el frontend (defecto) o endpoint de backend que exponga `MP_PUBLIC_KEY`?
- **OQ-2** Polling de pendiente: ¿5 s durante 2 min (defecto) u otros valores?
- **OQ-3** Email del pagador: ¿no precargar (defecto, necesario para sandbox) o precargar el del usuario?
- **OQ-4** Tras aprobar: ¿quedarse en la vista «¡Pago aprobado!» con enlaces (defecto) o redirigir sola a la confirmación del pedido?
- **OQ-5** ¿Un solo change (defecto) o partirlo en parte A (brick + resultado inmediato + errores) y parte B (polling, recarga desde el servidor, estado de pago en la confirmación)?
  - **Respuesta (2026-11-19, usuario): partir.** Este change pasa a ser la **parte A (C-20a)**: brick, resultado inmediato, reintento, `a_devolver` y errores 409/502/503. La **parte B (C-20b)**: polling del pendiente, reconstrucción del estado al recargar y estado del pago en la confirmación (bloque 7 y tarea 6.3). Pendiente: separar specs/tasks en dos changes y registrar C-20a/C-20b en CHANGES.md.
- **OQ-6** Textos de rechazo: ¿la tabla corta de D5 con genérico (defecto), ajustada tras probar `FUND`/`OTHE` en sandbox?
- **OQ-7** ¿Mostrar el estado del pago (`mp_status_detail` legible) también en la confirmación `/finalizar-compra/pedido/:id` para pedidos `MERCADOPAGO` (US-026)? Defecto: sí, una línea «Pago: rechazado — motivo» y el CTA «Pagar» se mantiene mientras el pedido siga `PENDIENTE`.

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: pendiente
- Approval: pending
- Preview: pendiente

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844): formulario (cargando, listo, procesando), aprobado, rechazado con motivo + reintento, pendiente (esperando y demorando), aprobado sin stock (`a_devolver`), no se paga con tarjeta, ya no se puede pagar, pedido no encontrado, pago no disponible (sin clave / 503), resultado desconocido (502), y la línea de estado de pago en la confirmación (OQ-7). El brick se representa con un recuadro de muestra marcado como «Formulario de Mercado Pago (simulado)».
