# Design — C-19 `fe-checkout-pedido`

## Context

Motivación, contrato observado del backend y alcance: ver `proposal.md`. Requisitos: `specs/frontend-checkout` y `specs/frontend-cart` de este change.

Puntos de partida relevantes (verificados en `dev`, 2026-11-19):

- **Carrito** (`@/entities/cart`): `selectLineas`, `subtotalLinea`, `selectTotalPrecio` (string decimal), `textoPersonalizacion`, `vaciar`, `claveLinea`. Las líneas no repiten `(productoId, personalizacion)` (misma clave → misma línea), así que el backend no debería ver duplicados salvo carritos manipulados.
- **Direcciones** (`@/entities/direccion`): `SelectorDireccion` controlado (`valor: number | null | undefined`, `onCambiar`, `permitirRetiro`, `leyenda`) que preselecciona y maneja carga/error/vacío; `ResumenDireccion` y `direccionQueries`.
- **API**: `aApiError` normaliza todo a `ApiError {status, code, detail, field}`; regla del cliente: decidir por `code`. Los errores de `POST /pedidos/` llegan como `HTTP_400`/`HTTP_404` con el caso solo en `detail` (proposal §Why).
- **Router**: `PAGINAS` por `RUTAS` (mapa con dueño) + rutas sueltas como `RUTA_PRODUCTO` envueltas en `RequiereAcceso`. `PlaceholderPage({title, owner})` dibuja la página provisoria. `DuenoRuta` no incluye `C-20`.
- **Formularios**: TanStack Form (`@tanstack/react-form` 1.x) en direcciones y admin; TanStack Query para server state; `useUiStore` para toasts/confirmaciones.
- **Shell**: `ShellConSesion` expone roles de la sesión (`useSesion`/`selectRoles` en `@/entities/session`).

## Goals / Non-Goals

**Goals:**
- Checkout de una sola pantalla con los estados del mockup, que crea el pedido con un único POST y no pierde el carrito ante errores.
- Confirmación recargable (vive en una URL con el id del pedido) que explica la confirmación manual (DD-22) o entrega el pedido al pago con tarjeta (C-20).
- Montos de envío/descuento de DD-10 en un solo lugar, marcados para PA-11/PA-13.

**Non-Goals:**
- Brick de tarjeta, `POST /pagos/crear`, `paymentStore` (C-20).
- Listado/detalle/cancelación de pedidos (C-21) — la confirmación solo enlaza a `/mis-pedidos`.
- Tocar `backend/` (salvo decisión distinta en OQ-1/OQ-2).
- Alta de dirección dentro del checkout (enlace a `/direcciones`).

## Decisions

### D1 — Rutas
- `/finalizar-compra` → `FinalizarCompraPage`; `/finalizar-compra/pedido/:pedidoId` → `PedidoCreadoPage`; `/finalizar-compra/pedido/:pedidoId/pago` → `PlaceholderPage` con dueño `C-20` (punto de traspaso).
- Las tres con `RequiereAcceso acceso={{ roles: ['CLIENT'] }}` (el backend exige `CLIENT` para crear y para pagar). No son secciones de navegación: se declaran como `RUTA_PRODUCTO` (constantes `RUTA_FINALIZAR_COMPRA`, `RUTA_PEDIDO_CREADO`, `RUTA_PAGO_PEDIDO` y helpers `rutaPedidoCreado(id)`, `rutaPagoPedido(id)` en `shared/config/routes.ts`), fuera de `RUTAS`/`ACCESO_RUTAS`, así no cambian las specs del mapa de rutas ni de la navegación. `DuenoRuta` suma `'C-20'` para la provisoria.
- Paths en español, como el resto. *Alternativas*: `/checkout` (inglés, rompe la convención); confirmación dentro de `/mis-pedidos/:id` (es de C-21 y aún no existe).

### D2 — Ubicación FSD
- `entities/pedido/`:
  - `model/`: tipos `PedidoCrear`, `ItemPedidoCrear`, `PedidoDetalle`, `DetallePedido`, `FormaPagoCodigo = 'MERCADOPAGO' | 'EFECTIVO' | 'TRANSFERENCIA'`; `FORMAS_PAGO` (código, etiqueta, descripción, `confirmacionManual: boolean`); `COSTO_ENVIO = '50.00'` y `DESCUENTO = '0.00'` con comentario `[PENDIENTE DE DECISIÓN: PA-11]` / `[PENDIENTE DE DECISIÓN: PA-13]` (DD-10); `itemsDesdeCarrito(lineas)` (puro); `totalEstimado(subtotal)`; `clasificarErrorCreacion(error)` (D6).
  - `api/`: `crearPedido(datos)`, `obtenerPedido(id)`, `pedidoQueries` (`todas()` = `['pedidos']`, `detalle(id)`), `useCrearPedido()` que en `onSuccess` siembra `pedidoQueries.detalle(id)` con la respuesta e invalida `['pedidos']` (para C-21).
- `pages/finalizar-compra/`: `FinalizarCompraPage`, `PasoEntrega` (envuelve `SelectorDireccion`), `PasoFormaPago`, `CampoNotas`, `ResumenPedido`, `AvisoErrorPedido`, `finalizar-compra.css`. Estado del formulario con TanStack Form (direccion, formaPago, notas) — es un formulario con validación y envío, como direcciones.
- `pages/pedido-creado/`: `PedidoCreadoPage`, `PasosConfirmacionManual`, `TraspasoPago`.
- **Sin `features/crear-pedido`**: hay un solo consumidor (la página); se extrae si C-20/C-21 lo reutilizan (FSD: no extraer antes de reutilizar). `itemsDesdeCarrito` vive en `entities/pedido` y recibe líneas tipadas de `@/entities/cart` — entidades no se importan entre sí en FSD estricto, así que la función recibe un tipo estructural mínimo (`{productoId, cantidad, personalizacion}`) definido en `entities/pedido`, y la página pasa las líneas del carrito.

### D3 — Formas de pago sin endpoint — *confirmar en OQ-2*
Catálogo local `FORMAS_PAGO` con los tres códigos del seed (DD-17 consecuencias: `MERCADOPAGO/EFECTIVO/TRANSFERENCIA`) y etiquetas «Tarjeta (Mercado Pago)», «Efectivo», «Transferencia bancaria». Ninguna preseleccionada (elección explícita; evita pagar con un método por omisión). Si el admin deshabilita una en la base, el cliente lo sabe por el 400 al confirmar (D6). Al elegir una de `confirmacionManual` se muestra la nota DD-22 debajo del grupo; con Mercado Pago, «El pago con tarjeta lo hacés en el paso siguiente, con Mercado Pago».
*Alternativa (OQ-2)*: endpoint `GET /api/v1/formas-pago` (solo habilitadas) en el backend y `formaPagoQueries` — fuente única, pero amplía el alcance a backend.

### D4 — Resumen y totales (DD-10, PA-11, PA-13)
Resumen lateral (sticky en desktop, debajo en mobile y con el botón al final): líneas compactas (nombre, «Sin …», `cantidad ×`, subtotal), «Subtotal» (`selectTotalPrecio`), «Costo de envío» `$ 50`, «Descuento» `$ 0`, «Total estimado». Notas: «El total final lo confirma el servidor con los precios vigentes» y la de stock DD-20 («Verificamos el stock al crear el pedido, pero no lo reservamos: se descuenta cuando el pedido se confirma»). Con «Retiro en el local» el envío sigue en `$ 50` y se aclara «Tarifa fija por pedido, también con retiro» (PA-13 abierta: el backend lo cobra siempre). Cálculo con los helpers de centavos del carrito (`aCentavos` se expone o se agrega `sumarImportes`) — sin aritmética de floats.

### D5 — Envío y post-éxito
`onSubmit` del formulario → `useCrearPedido().mutateAsync(...)` con `itemsDesdeCarrito(lineas)` (`personalizacion` ordenada; `[]` si no hay), `notas` recortada u omitida. Mientras `isPending`: botón deshabilitado «Creando pedido…» con spinner y `fieldset disabled` en los pasos (evita doble envío; el backend no tiene idempotencia de creación, R2). Éxito: el total estimado viaja en `navigate(rutaPedidoCreado(id), { state: { totalEstimado } })` (no en `sessionStorage`) (sobrevive al render, no a la recarga: tras recargar no se muestra el aviso de precios, aceptable), luego `vaciar()` del carrito (D8, OQ-3) y toast `success` «Pedido #N creado».
El orden importa: navegar antes de vaciar evita que la guarda «carrito vacío → /carrito» del checkout redirija antes de tiempo.

### D6 — Errores de creación — *confirmar en OQ-1*
`clasificarErrorCreacion(error: ApiError)` → `'productos' | 'forma-pago' | 'conexion' | 'sin-permiso' | 'otro'`:
- `status === null` o `>= 500` → `conexion` (acción «Reintentar» = re-enviar los mismos valores).
- `403` → `sin-permiso`. `401` lo resuelve el interceptor/sesión existente.
- `422` → `otro` (no debería pasar: el formulario valida).
- `400/404`: el backend no da código estable. **Defecto (A)**: el clasificador compara `detail` con los textos del contrato actual (`'Forma de pago no encontrada'`, `'Forma de pago no está habilitada'` → `forma-pago`; `'Producto no encontrado'`, `'Producto no disponible'`, `'No hay stock suficiente'`, `'No puede pedir dos veces…'` → `productos`) en **un único lugar**, con tests por texto, como excepción documentada a la regla «decidir por `code`»; texto desconocido → `otro` (muestra ambas acciones).
- El aviso (`role="alert"`, `tabIndex=-1`, recibe el foco) muestra siempre el `detail` del servidor. `productos` → «Revisar carrito»; `forma-pago` → «Elegí otra forma de pago» + foco al grupo de pago al pulsar; `conexion` → «Reintentar».
- Ninguna acción vacía el carrito ni limpia las elecciones. El aviso desaparece al cambiar cualquier elección o al reenviar.
*Alternativa (B, OQ-1)*: agregar al backend `ErrorCode` `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `INSUFFICIENT_STOCK` (ya existe), `PAYMENT_METHOD_UNAVAILABLE`, `DUPLICATE_ITEM` con `field` (`forma_pago_codigo` / `items`) y, mejor aún, el `producto_id` afectado; el clasificador pasa a ramificar por `code` y se podría marcar la línea culpable. Requiere tocar `PedidoService` y sus tests (governance MEDIO, backend).

### D7 — Confirmación
`PedidoCreadoPage` lee `:pedidoId`, usa `useQuery(pedidoQueries.detalle(id))` (sembrada por la mutación → sin pedido extra tras crear; tras recargar hace `GET /pedidos/{id}`). Estados: carga (skeleton), 403/404 → «No encontramos este pedido» + «Ver catálogo», error de red → reintentar. Contenido: encabezado con ícono de éxito «Pedido #N recibido», `badge` «Pendiente», tarjeta con entrega (dirección vía `direccionQueries` + `ResumenDireccion`; si `direccion_id` es `null`, «Retiro en el local»), forma de pago, ítems con snapshots y totales del servidor. Aviso «Los precios se actualizaron» si `location.state.totalEstimado` existe y difiere de `total`.
- **EFECTIVO/TRANSFERENCIA**: bloque «¿Qué sigue?» con 3 pasos (el local confirma tu pago → el pedido pasa a «Confirmado» y se prepara → seguilo en «Mis pedidos»); para transferencia, «El local te indica los datos para transferir» (no hay datos bancarios en el sistema; OQ-5). Sin acción de pago.
- **MERCADOPAGO** (`estado_codigo === 'PENDIENTE'`): bloque «Falta el pago» con «Pagar $ X con tarjeta» → `rutaPagoPedido(id)`. Si el pedido ya no está `PENDIENTE` (p. ej. lo canceló), se muestra el estado sin la acción.
- Aviso DD-20 común: «Si algún producto se agota antes de que se confirme, el pedido puede cancelarse por falta de stock».
- Acciones: «Ver mis pedidos» (provisoria de C-21) y «Seguir comprando».

### D8 — Cuándo se vacía el carrito — *confirmar en OQ-3*
Se vacía al **crear** el pedido, para cualquier forma de pago: el pedido ya congela líneas y precios; si el carrito quedara lleno, volver atrás y confirmar de nuevo crearía un segundo pedido `PENDIENTE` (no hay TTL, RN-ST-04). El reintento de pago con tarjeta se hace sobre el pedido (C-20), no sobre el carrito.
*Alternativa*: vaciar recién al aprobarse el pago para Mercado Pago (KB/07 paso 8 lo sugiere) — obliga a C-20 a coordinarse con el carrito y abre la puerta a pedidos duplicados.

### D9 — CTA en el carrito
`ResumenCarrito` suma `Link` estilo botón primario de ancho completo «Finalizar compra» → `RUTA_FINALIZAR_COMPRA` cuando la sesión tiene `CLIENT`; si no, nota «Solo las cuentas de cliente pueden hacer pedidos». La nota de envío cambia a «Se suma un costo de envío de $ 50. Los precios finales se confirman al crear el pedido». El CTA usa el valor de `COSTO_ENVIO` de `entities/pedido` (una sola fuente).

### D10 — Notas
Campo opcional «Notas para el local» (`textarea`, máx. 300 caracteres con contador; el backend no limita: OQ-4), colapsado detrás de «Agregar una nota» para no alargar el formulario en mobile.

### D11 — Tests (Strict TDD)
- Puros (Vitest): `itemsDesdeCarrito`, `totalEstimado`, `clasificarErrorCreacion` (un caso por texto conocido, desconocido, 403, 5xx, red).
- MSW: nuevo `test/msw/pedidos.ts` (estado en memoria: pedidos creados, cuerpos recibidos, respuesta configurable por test: 201, 400 con cada `detail`, 404, 403, 500, error de red, demora) + `GET /pedidos/:id`. Reutiliza `direcciones.ts`.
- Página (RTL, `renderApp('/finalizar-compra', { sesion: { roles: ['CLIENT'] } })` con carrito precargado): acceso (anónimo, ADMIN, carrito vacío), preselección y retiro, validación de forma de pago, cuerpo exacto enviado, «Creando pedido…» + doble clic, éxito (carrito vacío, URL), cada error (aviso, acción, carrito intacto), reintento, nota DD-22 al elegir efectivo/transferencia y ausencia de campos de tarjeta.
- Confirmación: desde caché tras crear (sin GET extra), recarga (GET), 404, efectivo/transferencia (pasos, sin «Pagar»), Mercado Pago (CTA → ruta de pago provisoria `C-20`), aviso de precios.
- Carrito: CTA para `CLIENT`, nota para `ADMIN`.
- axe: checkout con datos, con aviso de error y confirmación efectivo. Sin `vi.mock` de módulos propios; `userEvent.setup()`.

## Risks / Trade-offs

- **R1 [Errores sin código estable]** Clasificar por texto de `detail` es frágil: si el backend cambia un mensaje, cae en `otro` (muestra ambas acciones, no rompe). → Un único clasificador con tests por texto; OQ-1 propone la solución de fondo.
- **R2 [Pedidos duplicados]** El backend no tiene idempotencia de creación: un timeout tras commit + «Reintentar» puede crear dos pedidos. → Botón bloqueado mientras viaja; «Reintentar» solo tras error de red/5xx; se acepta (C-21 permite cancelar `PENDIENTE`). Registrado para C-25b.
- **R3 [Dirección no validada en backend]** `direccion_id` inexistente o ajeno no se valida (FK → posible 500). → El frontend solo envía ids del listado propio; deuda backend para C-25b.
- **R4 [Personalización no validada en backend]** (heredado de C-18) ids no removibles o ajenos se aceptan. → El frontend solo envía lo que el detalle ofrece; deuda backend C-25b.
- **R5 [Precio del carrito ≠ precio vigente]** → «Total estimado» + aviso «Los precios se actualizaron» en la confirmación (no se pide confirmación previa del nuevo total; el pedido queda `PENDIENTE` y se puede cancelar en C-21).
- **R6 [Formas de pago hardcodeadas]** Si se agrega una en la base, el frontend no la ofrece; si se deshabilita, el cliente se entera al confirmar. → OQ-2.
- **R7 [Envío cobrado en retiro]** PA-13 abierta: se muestra con aclaración; un cambio de regla solo toca `COSTO_ENVIO`/resumen.
- **R8 [Aviso de precios perdido al recargar]** `location.state` no sobrevive a la recarga. → Aceptado.

## Migration Plan

Sin migraciones ni cambios de backend por defecto. Rollback: revertir el commit (el carrito no cambia de formato).

## Open Questions

> Governance MEDIO. Cada pregunta tiene una **propuesta por defecto** que ya reflejan specs, mockups y tareas; el usuario las confirma junto con la aprobación de mockups. Si alguna respuesta difiere, se ajustan specs, mockups y tareas antes de `/opsx:apply`.

- **OQ-1 — Errores de creación sin código estable.** Defecto: **(A)** clasificar en el frontend por el texto de `detail` en un solo lugar (D6), sin tocar backend. Alternativa: **(B)** sumar códigos estables (+ producto afectado) en `PedidoService` dentro de este change (o en C-25b). **Resuelta: por defecto (usuario, 2026-11-19).**
- **OQ-2 — Formas de pago.** Defecto: **catálogo local** con las tres del seed (D3). Alternativa: endpoint `GET /formas-pago` (solo habilitadas) en el backend. **Resuelta: por defecto (usuario, 2026-11-19).**
- **OQ-3 — Momento de vaciar el carrito.** Defecto: **al crear el pedido**, para toda forma de pago (D8). Alternativa: con Mercado Pago, al aprobarse el pago (C-20). **Resuelta: por defecto (usuario, 2026-11-19).**
- **OQ-4 — Notas del pedido.** Defecto: **campo opcional colapsado, máx. 300** (D10). Alternativas: sin campo de notas; otro tope. **Resuelta: por defecto (usuario, 2026-11-19).**
- **OQ-5 — Datos para transferir.** Defecto: **mensaje genérico** («El local te indica los datos para transferir»), sin CBU/alias (no existen en el sistema). Alternativa: texto fijo con datos `(TBD)` provistos por el PO. **Resuelta: por defecto (usuario, 2026-11-19).**
- **OQ-6 — PA-13 (retiro con envío)** `[PENDIENTE DE DECISIÓN: PA-13]`. Defecto: **retiro habilitado** (`permitirRetiro` true) y envío `$ 50` también en retiro, con la aclaración «Tarifa fija por pedido, también con retiro» (es lo que cobra el backend). PA-11 (reglas de envío/descuento) `[PENDIENTE DE DECISIÓN: PA-11]`: se mantienen 50.00 / 0 (DD-10). **Resuelta: por defecto (usuario, 2026-11-19).**

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-19-fe-checkout-pedido/mockups/` (`carrito-checkout.html`, `finalizar-compra.html`, `pedido-creado.html`, `pago-provisorio.html`, `README.md`, `previews/`)
- Approval: approved (2026-11-19, by user) — incluye los defaults de OQ-1..OQ-6
- Visual verify: passed (2026-11-19, con aprobación del usuario para levantar el dev server). App real (backend + PostgreSQL con seed, cliente `cliente@foodstore.com`) capturada a 1440x900 y 390x844 en `mockups/verify/` (24 capturas): carrito con CTA, checkout (efectivo, transferencia, Mercado Pago, retiro, validación), errores de stock y de forma de pago (respuesta simulada con los textos reales de `PedidoService`, verificados contra `backend/app/modules/pedidos/service.py`), pedido creado real EFECTIVO (#3) y MERCADOPAGO (#4), recarga de la confirmación y carrito vacío tras crear. Coincide con los mockups. Diferencias menores (sin bloqueo): (minor) el aviso de error recibe el foco pero sin anillo visible (foco programático, sin `:focus-visible`); (minor) «Gestionar direcciones» sin subrayado; (minor) un 404 de un recurso estático en consola (no del API). Sin errores 5xx ni errores de consola propios del flujo (los 401 son el refresh previo al login y los 400 son los errores simulados). Las tres se corrigieron después del verify (2026-11-19, sin volver a capturar): `.form-alert:focus` en lugar de `:focus-visible` (`finalizar-compra.css`), subrayado en `.sel-foot a` (`direccion.css`, también mejora WCAG 1.4.1) y `<link rel="icon" href="data:,">` en `index.html` hasta tener el logo definitivo. En las capturas mobile de página completa el header fijo aparece a mitad de página: es un artefacto de la captura, no de la app.
- Visual verify previo (apply): manual (2026-11-19). No se levantó servidor (regla 13) ni se compararon capturas de la app contra los mockups; la fidelidad se cubre con tests por rol/nombre accesible y la hoja de estilos (`finalizar-compra.css`, `pedido-creado.css`, `carrito.css`, `pedido.css`) se portó de `mockup.css`. Lista de revisión manual por pantalla (1440x900 y 390x844): (1) `/carrito` CLIENT: botón «Finalizar compra» a ancho completo y nota de envío `$ 50`; `/carrito` ADMIN: aviso «Solo las cuentas de cliente…» sin botón. (2) `/finalizar-compra`: pasos 1 y 2 numerados, «Casa» elegida, tres formas de pago en 3 columnas (1 en mobile), resumen sticky a la derecha (debajo en mobile). (3) Elegir efectivo/transferencia/Mercado Pago: caja informativa azul. (4) Confirmar sin forma de pago: borde rojo del paso 2 y mensaje. (5) «Agregar una nota» abre el paso 3 con contador. (6) Enviando: «Creando pedido…» y pasos atenuados. (7) Errores: aviso rojo con la acción de cada caso y foco visible. (8) Retiro: nota «Tarifa fija por pedido, también con retiro». (9) `/finalizar-compra/pedido/57` EFECTIVO/TRANSFERENCIA, MERCADOPAGO (caja «Falta el pago» con borde naranja), aviso de precios (ámbar) y «No encontramos este pedido». (10) `/finalizar-compra/pedido/58/pago`: página provisoria «Pago».
- Preview: rendered (2026-11-19, `mockups/previews/`, 22 estados × 1440x900 y 390x844 = 44 capturas de página completa; Edge + playwright-core, el Playwright MCP no tenía Chrome; sin errores de consola. Defecto corregido: faltaba separación vertical entre encabezado, aviso y pasos)

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844):

| Estado | Mockup |
|--------|--------|
| Carrito con CTA «Finalizar compra» y nota de envío | `carrito-checkout.html` |
| Carrito de un usuario sin rol `CLIENT` (sin CTA, con nota) | `carrito-checkout.html?rol=admin` |
| Checkout: principal preseleccionada, sin forma de pago, resumen con envío/descuento/total estimado | `finalizar-compra.html` |
| Validación «Elegí una forma de pago» | `finalizar-compra.html?estado=validacion` |
| Efectivo elegido con nota de confirmación manual (DD-22) | `finalizar-compra.html?estado=efectivo` |
| Mercado Pago elegido con nota «pago en el paso siguiente» | `finalizar-compra.html?estado=mercadopago` |
| Retiro en el local, sin direcciones, nota de envío en retiro (PA-13) | `finalizar-compra.html?estado=retiro` |
| Nota abierta | `finalizar-compra.html?estado=nota` |
| Enviando («Creando pedido…», campos deshabilitados) | `finalizar-compra.html?estado=enviando` |
| Error sin stock / no disponible / no encontrado / duplicado (→ «Revisar carrito») | `finalizar-compra.html?error=stock` · `no-disponible` · `no-encontrado` · `duplicado` |
| Error forma de pago deshabilitada (→ elegir otra) | `finalizar-compra.html?error=forma-pago` |
| Error de conexión (→ «Reintentar») | `finalizar-compra.html?error=red` |
| Confirmación Efectivo (pasos de confirmación manual) | `pedido-creado.html?forma=EFECTIVO` |
| Confirmación Transferencia | `pedido-creado.html?forma=TRANSFERENCIA` |
| Confirmación Mercado Pago (traspaso «Pagar $ X con tarjeta») | `pedido-creado.html?forma=MERCADOPAGO` |
| Confirmación con aviso «Los precios se actualizaron» | `pedido-creado.html?forma=EFECTIVO&estado=precios` |
| Pedido no encontrado | `pedido-creado.html?estado=no-encontrado` |
| Punto de traspaso (provisoria `C-20`) | `pago-provisorio.html` |
