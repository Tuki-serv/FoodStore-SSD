# Design — C-20a `fe-pago-tarjeta`

## Context

C-19 crea el pedido y, si es `MERCADOPAGO`, lleva al cliente a `/finalizar-compra/pedido/:pedidoId/pago` (hoy `PlaceholderPage`). El backend de cobro (C-12, Orders API, DD-26) está cerrado: `POST /pagos/crear` devuelve el resultado inmediato (aprobado/rechazado/pendiente/`a_devolver`) y `GET /pagos/{pedido_id}` el último intento; el webhook confirma de forma asíncrona y deja el mismo estado en la base. No hay retorno por redirect (DD-21). El frontend no tiene el SDK de MercadoPago ni la clave pública configurada; `paymentStore` (C-13b) existe pero con `mpPaymentId: number` (desactualizado).

C-20 se partió en dos (OQ-5, 2026-11-19): **C-20a** (este change) cubre el brick, el envío, el resultado inmediato, el reintento, `a_devolver` y los errores; **C-20b** `fe-pago-seguimiento` cubre el polling del pendiente, la reconstrucción de la vista al recargar y el estado del pago en la confirmación. Este diseño deja los puntos de extensión para C-20b (D4) sin implementarlos.

Restricciones: governance CRÍTICO, PCI SAQ-A (los datos de tarjeta solo en el brick), FSD con imports hacia abajo, server state en TanStack Query y client state en Zustand, TS `strict` sin `any`, Strict TDD.

## Goals / Non-Goals

**Goals**
- Página de pago real con `CardPayment`, envío del cuerpo exacto de `CrearPagoRequest`, vistas del resultado inmediato, reintento, caso `a_devolver` (DD-20), «no corresponde pagar» y errores 409/400/502/503/red.
- Clave pública de MercadoPago servida por el backend (`GET /api/v1/pagos/config`, OQ-1), sin secretos ni variables nuevas en el frontend.

**Non-Goals**
- Polling del pendiente, consulta del último intento al montar la página (recarga) y estado del pago en la confirmación del pedido → **C-20b**.
- Otros cambios de backend: el contrato de cobro de C-12 queda tal cual; solo se agrega el endpoint de configuración (D3).
- Otros medios (Rapipago, Pago Fácil, cuenta MP), challenge 3DS (`action_required`) y Checkout Pro (DD-21).
- Reembolsos/cancelación de pagos (PA-08) y WebSocket (C-27).
- Listado «Mis pedidos» y timeline (C-21); acá solo se enlaza.

## Decisions

### D1 — Ruta y guarda
Se reutiliza `RUTA_PAGO_PEDIDO` (`/finalizar-compra/pedido/:pedidoId/pago`) y `ACCESO_CLIENTE`; en `app/router/routes.tsx` se reemplaza `<PlaceholderPage title="Pago" owner="C-20" />` por `<PagoPedidoPage />`. El resultado se muestra **en la misma ruta** (sin `/pago/resultado`); la vista sale de la caché de TanStack Query (D4), así C-20b solo tiene que llenar esa caché al montar para que la recarga funcione.

### D2 — Ubicación FSD
- `entities/payment`:
  - `api/`: `pagoQueries.estado(pedidoId)` (`['pagos', pedidoId]`, `GET /pagos/{pedido_id}`), `useCrearPago()` (mutación `POST /pagos/crear`; en `onSuccess` escribe la respuesta en la caché de `pagoQueries.estado`). Para no importar `entities/pedido` desde `entities/payment` (import cruzado entre slices), la invalidación del pedido la hace la **página** en el `onSuccess` de la llamada, o se usa el patrón `@x` si el linter `fsd-boundaries` lo exige (se decide en apply sin cambiar comportamiento).
  - `model/`: tipos (`PagoEstado`, `CrearPagoBody`, `RespuestaCrearPago`), `cuerpoDesdeBrick(pedidoId, datos, additional)` (pura), `vistaPago(pedido, pago)` (pura, D4), `motivoRechazo(detalle)` (pura, D5), `clasificarErrorPago(error)` (pura, D7), `montoDesdeTotal(total)` (pura, D9); `paymentStore` ajustado (D8).
- `features/pagar-con-tarjeta/`: `<FormularioTarjeta pedidoId monto onPagado />` que envuelve `initMercadoPago` + `CardPayment` del SDK, maneja `onReady`/`onError`/`onSubmit`, el estado procesando y el reintento (remontar con `key`). Es el **único** módulo que importa `@mercadopago/sdk-react`.
- `pages/pago-pedido/`: `PagoPedidoPage` compone pedido + pago + feature y renderiza la vista de D4.

### D3 — Clave pública desde el backend (OQ-1 = endpoint, decidido 2026-11-19)
- **Ruta**: `GET /api/v1/pagos/config` → 200 `{"public_key": "<MP_PUBLIC_KEY>"}` (schema `ConfiguracionPagosResponse`, `extra` prohibido en la salida: solo ese campo). Se declara en `pagos/router.py` **antes** de `GET /{pedido_id}` para que `config` no se intente leer como entero (422).
- **Auth (recomendada y adoptada)**: access token Bearer de un usuario activo, **sin restricción de rol** (`get_current_active_user`), igual que el resto de pagos. Motivos: la página de pago ya exige sesión `CLIENT`, el requisito «Rutas públicas de pagos» (el webhook es la única ruta pública) se mantiene sin modificarse, y no se publica la clave a anónimos (aunque no es secreta, reduce el uso por terceros). Alternativas descartadas: pública (obliga a modificar «Rutas públicas de pagos» y no aporta nada a una página con sesión) y solo `CLIENT` (ADMIN también puede pagar por la spec `payment-api` y probar en sandbox; restringir rol no protege nada porque la clave no es secreta).
- **Capas**: `PaymentService.obtener_configuracion_publica() -> ConfiguracionPagosResponse` lee `settings.MP_PUBLIC_KEY`; si es `None` o solo espacios lanza `AppError(503, "HTTP_503", "MercadoPago no configurado: falta MP_PUBLIC_KEY")` (mismo formato que `_exigir_configuracion_mp`). El router solo delega (regla 2). No hay acceso a la base: no hace falta repository ni UoW nuevos (no se crea CRUD vacío). La respuesta nunca incluye `MP_ACCESS_TOKEN` ni `MP_WEBHOOK_SECRET`.
- **Tests (pytest, TDD, PostgreSQL de tests)**: 200 con la clave configurada (vía `monkeypatch` de `settings`); 503 sin clave y con `"  "`; 401 sin token; el cuerpo tiene exactamente la clave `public_key`; fila `GET /api/v1/pagos/config` `AUTENTICADO` en `tests/support/rbac_matriz.py` (la matriz exige una fila por endpoint).
- **Frontend**: `pagoQueries.configuracion()` (`['pagos', 'config']`, `staleTime: Infinity`, sin reintentos ante 503) en `entities/payment/api`. `FormularioTarjeta` espera la clave; con 503 o error de red muestra «El pago con tarjeta no está disponible en este momento» sin montar el brick. `initMercadoPago(clave, { locale: 'es-AR' })` se llama una sola vez, perezosamente, al tener la clave. `shared/config/env.ts` no cambia (no hay `VITE_MP_PUBLIC_KEY`).

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

El orden de la tabla es la precedencia. En C-20a, `pago` es el contenido de la caché de `pagoQueries.estado(id)`, que se llena con la respuesta de `crear` (`setQueryData`) o con la consulta que se hace tras un 409; al montar la página la caché está vacía (`pago = null`), así que la vista inicial sale solo del pedido. En C-20b la página habilita la consulta al montar y el polling sobre la misma clave: `vistaPago` no cambia. La vista `pendiente` en C-20a es estática (mensaje + «Ver mi pedido»).

### D5 — Motivo del rechazo (OQ-6 = tabla corta + genérico, 2026-11-19)
`motivoRechazo(detalle)` mapea un conjunto chico de detalles conocidos a textos en voseo (fondos insuficientes, datos de la tarjeta, código de seguridad, vencimiento, rechazo del emisor/llamar para autorizar, monto no admitido, duplicado) y devuelve el genérico para el resto o `null`. Como Orders y Payments usan nombres distintos (`insufficient_amount` vs `cc_rejected_insufficient_amount`), se aceptan ambas variantes; la tabla final se ajusta con lo observado en sandbox (`FUND`, `OTHE`; pendiente de verificar en C-12, OQ-14). Se exporta desde `@/entities/payment` porque C-20b la reutiliza en la confirmación del pedido.

### D6 — Errores (`clasificarErrorPago`)
Sobre `ApiError` (`@/shared/api`): 409 → `no-permitido` (refetch del pedido y `fetchQuery` de `pagoQueries.estado`; la vista final la decide D4); 400 → `rechazado-datos` (vista rechazado con motivo genérico; el backend ya marcó el intento `rechazado`); 502 → `desconocido` (el token de tarjeta es de un solo uso: «Reintentar» remonta el brick para tokenizar de nuevo y el backend reutiliza el intento y su `X-Idempotency-Key`, sin cobrar dos veces); 503 → `no-disponible`; `status: null`/5xx → `conexion`; 401 lo resuelve el interceptor; 403/404 → «No encontramos este pedido». Los textos de cada clase están en la spec.

### D7 — `paymentStore`
Se mantiene solo en memoria, sin datos de tarjeta. Cambios: `mpPaymentId: string | null`, `ResultadoPago.estado` admite `a_devolver`, y `EstadoPago` agrega `a_devolver`. Uso: marcar `procesando` entre `onSubmit` y la respuesta para bloquear el doble envío aunque el brick se re-renderice; el resultado **de verdad** vive en la caché de TanStack Query (regla 8). Si en apply el `isPending` de la mutación alcanza para todo, se reporta la opción de retirar el store (no se retira sin OK).

### D8 — Formato del monto
`initialization.amount` del brick es `number`: se convierte desde el `total` decimal en texto (`"2850.00"` → `2850`) con el helper de centavos existente (sin floats intermedios para comparar). El monto que cobra el backend sale del pedido, no del frontend: el valor del brick solo es informativo/cuotas.

### D9 — Pagador (OQ-3 = no precargar, 2026-11-19)
**No** se precarga el email en el brick: en sandbox el pagador debe ser un comprador de prueba distinto del usuario de Food Store, y precargarlo ocultaría el campo.

### D10 — Tras aprobar (OQ-4 = quedarse, 2026-11-19)
La página se queda en «¡Pago aprobado!» con los enlaces «Ver mi pedido» y «Seguir comprando» (sin redirección automática).

### D11 — Tests (Strict TDD)
- Backend (pytest contra PostgreSQL de tests): endpoint `GET /pagos/config` (D3).
- Unitarios puros: `cuerpoDesdeBrick`, `vistaPago`, `motivoRechazo`, `clasificarErrorPago`, `montoDesdeTotal`, `paymentStore`.
- Feature/página con RTL + MSW (`onUnhandledRequest: 'error'`). El SDK se reemplaza con `vi.mock('@mercadopago/sdk-react')` por un doble que expone botones «Simular pago» que invocan `onSubmit` con datos fijos, y `onReady`/`onError` (es un módulo de terceros, no propio; nunca se mockean módulos propios).
- Casos: aprobado, rechazado + reintento, 400, pendiente (vista estática), `a_devolver`, 409/502/503/red, no-tarjeta, no-pagable, 404, clave pública no disponible (503 de `/pagos/config`), cuerpo exacto del POST, doble envío.

## Risks / Trade-offs

- **SDK de terceros en tests**: el doble del brick no prueba el iframe real → se cubre con la prueba manual en sandbox (verify) y la referencia `sandbox/pago-prueba.html` de C-12.
- **Token de un solo uso**: un reintento tras 502 obliga a reingresar la tarjeta; aceptable y seguro.
- **Recarga sin C-20b**: hasta C-20b, recargar tras un pago aprobado muestra «Este pedido ya no se puede pagar» y tras un rechazo el formulario sin motivo; un pago pendiente recargado vuelve al formulario y un nuevo envío recibe 409, que lleva a la vista pendiente. No hay riesgo de doble cobro (lo bloquea el backend).
- **Doble cobro**: lo evita el backend (idempotencia por intento + webhook `a_devolver`); el frontend solo bloquea el doble envío.
- **Una request más al abrir el pago** (`/pagos/config`): se cachea para toda la sesión (`staleTime: Infinity`); a cambio hay una sola fuente de credenciales (el `.env` del backend).
- **Nombres de `status_detail` de Orders** no verificados para todos los casos → genérico como red de seguridad.

## Migration Plan

Sin migraciones. Backend: endpoint nuevo de solo lectura; `MP_PUBLIC_KEY` ya existe en `config.py` (documentar en el README que hace falta para el pago con tarjeta; sin valores reales). Frontend: instalar `@mercadopago/sdk-react` (versión exacta; **instalada `1.1.0`**, última estable al 2026-11-19, fijada sin `^` en `package.json`). Rollback: volver a la `PlaceholderPage` en `routes.tsx` y quitar la ruta `GET /pagos/config`.

## Open Questions

- **OQ-1** Clave pública: ¿`VITE_MP_PUBLIC_KEY` opcional en el frontend o endpoint de backend que exponga `MP_PUBLIC_KEY`?
  - **Respuesta (2026-11-19, usuario): endpoint del backend** (no el defecto). Ver D3: `GET /api/v1/pagos/config`, autenticado sin restricción de rol (recomendación adoptada), 503 sin clave; no hay variable `VITE_*` nueva.
- **OQ-3** Email del pagador: ¿no precargar (defecto, necesario para sandbox) o precargar el del usuario?
  - **Respuesta (2026-11-19, usuario): no precargar** (defecto).
- **OQ-4** Tras aprobar: ¿quedarse en la vista «¡Pago aprobado!» con enlaces (defecto) o redirigir sola a la confirmación del pedido?
  - **Respuesta (2026-11-19, usuario): quedarse** en «¡Pago aprobado!» con los enlaces (defecto).
- **OQ-5** ¿Un solo change o partirlo?
  - **Respuesta (2026-11-19, usuario): partir.** Este change es la **parte A (C-20a)**: brick, resultado inmediato, reintento, `a_devolver` y errores 409/502/503. La **parte B (C-20b `fe-pago-seguimiento`)**: polling del pendiente, reconstrucción del estado al recargar y estado del pago en la confirmación. OQ-2 y OQ-7 pasaron a C-20b.
- **OQ-6** Textos de rechazo: ¿la tabla corta de D5 con genérico (defecto), ajustada tras probar `FUND`/`OTHE` en sandbox?
  - **Respuesta (2026-11-19, usuario): tabla corta + genérico** (defecto), ajustada tras la prueba en sandbox (tarea 9.1).

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-20a-fe-pago-tarjeta/mockups/` (`pago-pedido.html?estado=…`, capturas en `mockups/previews/`)
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, headless Microsoft Edge desde `file://`, 1440x900 y 390x844)
- Visual verify: passed (2026-11-19, built-in browser con backend y frontend reales y la clave de prueba configurada; capturas en `mockups/verify/`). Revisado: formulario con el brick real de MP a 1440x900 y 390x844 (coincide con el layout del mockup; MP muestra su propio esqueleto unos segundos mientras carga; sin scroll horizontal), `no-tarjeta` (pedido EFECTIVO), `no-pagable` (pedido CONFIRMADO) y `no-encontrado`; `GET /pagos/config` 200. Sin errores de consola en la página. No revisado en vivo: `procesando`, `aprobado`, `rechazado`, `a-devolver`, `pendiente`, `desconocido` (502), `no-disponible` (503) y `conexion`: necesitan un pago real y se verifican durante la prueba en sandbox (9.1); están cubiertos por los tests de `pago-pedido.test.tsx`.
- Sandbox (9.1, 2026-11-19, Orders API con credenciales de prueba, tarjeta Visa de prueba AR): `FUND` → `failed`/`insufficient_amount` → «La tarjeta no tiene fondos suficientes.» ✓; «Intentar de nuevo» recarga el brick vacío ✓; `OTHE` → `failed`/`rejected_by_issuer` → caía en el genérico, **se agregó `rejected_by_issuer` → texto de emisor** (test RED→GREEN en `motivo-rechazo.test.ts`); `APRO` → `approved`, «¡Pago aprobado!», pedido #4 `CONFIRMADO`, número de operación `PAY…` visible ✓; `CONT` (pedido #5 creado desde el checkout) → `processing`/`in_process` → vista pendiente estática ✓. El brick pide «cuotas» recién después de reconocer la tarjeta. No probado: webhook/seguimiento del pendiente (C-20b), `a_devolver`, 502/503/sin conexión (cubiertos por tests). Capturas: `mockups/verify/rechazado-fund-1440.jpg`, `aprobado-1440.jpg`, `pendiente-1440.jpg`.

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844): formulario (cargando, listo, procesando), aprobado, rechazado con motivo + reintento, pendiente (estático, sin seguimiento), aprobado sin stock (`a_devolver`), no se paga con tarjeta, ya no se puede pagar, pedido no encontrado, pago no disponible (`/pagos/config` o `crear` con 503), resultado desconocido (502) y sin conexión. El brick se representa con un recuadro de muestra marcado como «Formulario de Mercado Pago (simulado)». Los estados «pendiente con seguimiento», «la confirmación está demorando» y la línea de estado del pago en la confirmación son de C-20b.
