# Tasks — C-19 `fe-checkout-pedido`

> **Governance MEDIO**: implementar por bloques con checkpoints; las decisiones no obvias se reportan al usuario. Gate: los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) y las respuestas a OQ-1..OQ-6 registradas antes de escribir código. Si una respuesta difiere del defecto (p. ej. OQ-1 = B o OQ-2 = endpoint), se ajustan specs, mockups y estas tareas antes del bloque 1 (incluye tareas de backend con pytest).
> **Criterios de aceptación visual**: `mockups/carrito-checkout.html`, `finalizar-compra.html`, `pedido-creado.html` y `pago-provisorio.html` de este change.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `tanstack-form`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Red simulada solo con MSW (`onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()` con `await`). Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones; `entities/pedido` no importa de `entities/cart`); TS `strict` sin `any`; pedidos = server state (TanStack Query), carrito = client state (Zustand); no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear. No se toca `backend/` (salvo OQ-1/OQ-2). Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con los estados de la tabla de `design.md` §UI Mockups (`carrito-checkout.html`, `finalizar-compra.html` con `?estado=` y `?error=`, `pedido-creado.html` con `?forma=` y `?estado=`, `pago-provisorio.html`), `mockup.css`/`mockup.js` copiados de C-18, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 Mostrar los mockups y OQ-1..OQ-6 al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md` y la respuesta (o «por defecto») de cada OQ en `design.md`. Verificación: ambos archivos con la aprobación y las OQ resueltas.

## 1. Red de seguridad

- [x] 1.1 Ejecutar `npm test`, `npm run typecheck` y `npm run lint`; anotar acá la línea base (archivos/tests verdes). Si algo falla, frenar y reportarlo como falla previa.
  - **Línea base (2026-11-19)**: `npm test` 92 archivos / 848 tests verdes; `typecheck` y `lint` limpios.

## 2. Entidad `pedido`: modelo puro (spec `frontend-checkout`)

- [x] 2.1 RED: `src/entities/pedido/__tests__/items-desde-carrito.test.ts`: dos líneas (`{productoId:1,cantidad:2,personalizacion:[3,1]}`, `{productoId:5,cantidad:1,personalizacion:[]}`) → `[{producto_id:1,cantidad:2,personalizacion:[1,3]},{producto_id:5,cantidad:1,personalizacion:[]}]`. Ejecutar → falla.
- [x] 2.2 GREEN + TRIANGULATE `itemsDesdeCarrito` (tipo estructural propio, design D2): orden de líneas preservado; ids ya ordenados quedan igual; no muta la entrada. Ejecutar → verde.
- [x] 2.3 RED → GREEN + TRIANGULATE `totalEstimado(subtotal)` con `COSTO_ENVIO`/`DESCUENTO` (DD-10, comentarios `[PENDIENTE DE DECISIÓN: PA-11]`/`PA-13`): «3800.00» → «3850.00»; «0.10» → «50.10»; «1250.50» → «1300.50». Reutiliza los helpers de centavos (sin floats). Ejecutar → verde.
- [x] 2.4 RED → GREEN + TRIANGULATE `FORMAS_PAGO`: tres códigos en orden MERCADOPAGO, EFECTIVO, TRANSFERENCIA con etiquetas «Tarjeta (Mercado Pago)», «Efectivo», «Transferencia bancaria»; `confirmacionManual` verdadero solo en EFECTIVO/TRANSFERENCIA; `esConfirmacionManual('MERCADOPAGO')` falso. Ejecutar → verde.
- [x] 2.5 RED → GREEN + TRIANGULATE `clasificarErrorCreacion` (design D6, OQ-1): un caso por texto de backend («No hay stock suficiente», «Producto no disponible», «Producto no encontrado» 404, «No puede pedir dos veces el mismo producto con la misma personalización» → `productos`; «Forma de pago no está habilitada», «Forma de pago no encontrada» → `forma-pago`); `status: null` y 500 → `conexion`; 403 → `sin-permiso`; 400 con texto desconocido → `otro`. Ejecutar → verde.

## 3. Entidad `pedido`: API y queries

- [x] 3.1 Crear `src/test/msw/pedidos.ts` (estado en memoria: cuerpos recibidos, próximo id, respuesta configurable por test —201, 400/404/403/500 con `{detail, code, field}`, error de red, demora— y `GET /pedidos/:id` con 404 para ids desconocidos) y registrarlo en el servidor MSW de tests. Verificación: usado por los tests de 3.2.
- [x] 3.2 RED → GREEN `crearPedido`/`useCrearPedido`: POST a `/api/v1/pedidos/` con el cuerpo exacto; tras éxito la caché `pedidoQueries.detalle(57)` contiene la respuesta (sin GET extra) y `['pedidos']` queda invalidada. TRIANGULATE: error 400 llega como `ApiError` con `detail`; `obtenerPedido(57)` hace GET y tipa la respuesta. Ejecutar → verde.
- [x] 3.3 REFACTOR: `src/entities/pedido/index.ts` como API pública (tipos, `FORMAS_PAGO`, `COSTO_ENVIO`, `DESCUENTO`, helpers, `pedidoQueries`, `useCrearPedido`); suite, typecheck y lint verdes.

## 4. Rutas

- [x] 4.1 RED: `src/app/router/__tests__/rutas-checkout.test.tsx`: anónimo en `/finalizar-compra` → `/ingresar` con la ruta recordada; `ADMIN` → «Sin permiso»; `CLIENT` en `/finalizar-compra/pedido/58/pago` → página provisoria «Pago» con dueño `C-20`. Ejecutar → falla.
- [x] 4.2 GREEN: constantes y helpers en `shared/config/routes.ts` (`RUTA_FINALIZAR_COMPRA`, `RUTA_PEDIDO_CREADO`, `RUTA_PAGO_PEDIDO`, `rutaPedidoCreado`, `rutaPagoPedido`), `DuenoRuta` con `'C-20'`, tres rutas en `app/router/routes.tsx` con `RequiereAcceso acceso={{ roles: ['CLIENT'] }}` (design D1). Ejecutar → verde; el test del mapa de rutas existente sigue verde.

## 5. CTA en el carrito (spec `frontend-cart`)

- [x] 5.1 RED: en `src/pages/carrito/__tests__/carrito-checkout.test.tsx`, `CLIENT` con productos ve el enlace «Finalizar compra» y al pulsarlo la URL pasa a `/finalizar-compra`. Ejecutar → falla.
- [x] 5.2 GREEN + TRIANGULATE (design D9): sesión solo `ADMIN` → sin «Finalizar compra» y con «Solo las cuentas de cliente pueden hacer pedidos»; la nota del resumen menciona «$ 50» de envío; carrito vacío → sin CTA. Ajustar el test existente de la nota si cambia el texto. Ejecutar → verde.

## 6. Pantalla «Finalizar compra» (spec `frontend-checkout`)

- [x] 6.1 RED: `src/pages/finalizar-compra/__tests__/finalizar-compra.test.tsx` con `renderApp('/finalizar-compra', { sesion: { roles: ['CLIENT'] } })`, carrito precargado (2 «Hamburguesa Clásica» `"1500.00"` sin cebolla/tomate, 1 «Coca-Cola 500ml» `"800.00"`) y direcciones «Casa» (principal, id 4) y «Trabajo»: título «Finalizar compra», grupos «¿Dónde lo recibís?» con «Casa» elegida y «Forma de pago» sin elección, resumen con «Sin cebolla, sin tomate», subtotal «$ 3.800», envío «$ 50», descuento «$ 0», total estimado «$ 3.850». Ejecutar → falla.
- [x] 6.2 GREEN: `pages/finalizar-compra/` (página, `PasoEntrega`, `PasoFormaPago`, `ResumenPedido`, CSS, `index.ts`), import del CSS en `app/styles/index.css` (lo verifica `styles-compile`). Ejecutar → verde.
- [x] 6.3 TRIANGULATE acceso y entrega: carrito vacío → `/carrito` con «Tu carrito está vacío»; sin direcciones → «No tenés direcciones guardadas», «Retiro en el local» elegido y nota «Tarifa fija por pedido, también con retiro». Ejecutar → verde.
- [x] 6.4 RED → GREEN + TRIANGULATE forma de pago: confirmar sin elegir → «Elegí una forma de pago», foco en el grupo, ningún POST registrado en MSW; elegir «Efectivo» → nota de confirmación manual; «Transferencia bancaria» → misma nota; «Tarjeta (Mercado Pago)» → «El pago con tarjeta lo hacés en el paso siguiente»; en ningún caso hay campos de tarjeta (`queryByLabelText(/número de tarjeta/i)` nulo). Ejecutar → verde.
- [x] 6.5 RED → GREEN + TRIANGULATE notas (OQ-4): «Agregar una nota» abre «Notas para el local» (máx. 300, contador); texto con espacios se envía recortado; vacío no envía `notas`. Ejecutar → verde.

## 7. Crear el pedido

- [x] 7.1 RED: «Efectivo» + «Confirmar pedido» → MSW recibe `{direccion_id:4, forma_pago_codigo:'EFECTIVO', items:[{producto_id:1,cantidad:2,personalizacion:[1,3]},{producto_id:5,cantidad:1,personalizacion:[]}]}`; URL `/finalizar-compra/pedido/57`; carrito vacío; toast «Pedido #57 creado». Ejecutar → falla.
- [x] 7.2 GREEN: `onSubmit` con `useCrearPedido` (design D5: navegar con `state.totalEstimado` y después vaciar). Ejecutar → verde.
- [x] 7.3 TRIANGULATE: «Retiro en el local» → `direccion_id: null`; con demora en MSW, el botón muestra «Creando pedido…» deshabilitado, los grupos están deshabilitados y un doble clic registra un solo POST. Ejecutar → verde.

## 8. Errores al crear

- [x] 8.1 RED: MSW responde 400 «No hay stock suficiente» → alerta «No pudimos crear el pedido» con el mensaje, foco en la alerta, enlace «Revisar carrito» a `/carrito`, carrito intacto, botón habilitado. Ejecutar → falla.
- [x] 8.2 GREEN: `AvisoErrorPedido` con `clasificarErrorCreacion` (design D6). Ejecutar → verde.
- [x] 8.3 TRIANGULATE: «Producto no disponible» (400), «Producto no encontrado» (404) y duplicado (400) → «Revisar carrito»; «Forma de pago no está habilitada» → «Elegí otra forma de pago» que lleva el foco al grupo, con la forma elegida aún marcada; error de red → «No pudimos conectar con el servidor.» + «Reintentar» que reenvía el mismo cuerpo (2 POST iguales en MSW) y, con 201, navega a la confirmación; 500 → «Reintentar»; 403 → «Solo las cuentas de cliente pueden hacer pedidos»; cambiar la forma de pago oculta la alerta. Ejecutar → verde.
- [x] 8.4 axe sin violaciones en el checkout con datos y con la alerta de stock. Ejecutar → verde.

## 9. Confirmación y traspaso (spec `frontend-checkout`)

- [x] 9.1 RED: `src/pages/pedido-creado/__tests__/pedido-creado.test.tsx`: tras crear el pedido 57 `EFECTIVO` (flujo completo desde el checkout) se ve «Pedido #57 recibido», «Pendiente», «Casa», «Efectivo», total «$ 3.850», bloque «¿Qué sigue?» con la confirmación manual, sin «Pagar», y MSW no registró `GET /pedidos/57`. Ejecutar → falla.
- [x] 9.2 GREEN: `pages/pedido-creado/` (página, `PasosConfirmacionManual`, `TraspasoPago`, CSS, `index.ts`) y su ruta (design D7). Ejecutar → verde.
- [x] 9.3 TRIANGULATE: abrir directo `/finalizar-compra/pedido/57` → GET y mismo contenido (sin aviso de precios); `TRANSFERENCIA` → nota «El local te indica los datos para transferir» y sin «Pagar» (OQ-5); `MERCADOPAGO` total `"2850.00"` → «Falta el pago» y «Pagar $ 2.850 con tarjeta» que lleva a `/finalizar-compra/pedido/58/pago` (provisoria C-20); `MERCADOPAGO` ya `CANCELADO` → sin «Pagar»; total del servidor `"4050.00"` con estimado «3850.00» → «Los precios se actualizaron»; `direccion_id: null` → «Retiro en el local»; 404 → «No encontramos este pedido» con «Ver catálogo»; aviso DD-20 de falta de stock visible; enlaces «Ver mis pedidos» y «Seguir comprando». Ejecutar → verde.
- [x] 9.4 axe sin violaciones en la confirmación de efectivo y de Mercado Pago. Ejecutar → verde.

## 10. Cierre

- [x] 10.1 `npm test`, `npm run typecheck`, `npm run lint` verdes; `fsd-boundaries` sin violaciones; anotar el total de tests contra la línea base del 1.1.
  - **Resultado (2026-11-19)**: 107 archivos / 986 tests verdes (+15 archivos, +138 tests sobre 92/848); `typecheck` y `lint` limpios; `tests/architecture` (`fsd-boundaries`, `styles-compile`, `tailwind-tokens`) verdes. Un test de `guards.test.tsx` falló una vez en una corrida paralela por tiempo (1,2 s) y pasa solo y en la corrida completa (flaky preexistente, no del change).
- [x] 10.2 Revisión SOLID/DRY del diff (un solo `COSTO_ENVIO`; aritmética de centavos compartida con el carrito; clasificador de errores único; `SelectorDireccion`/`ResumenDireccion`/`textoPersonalizacion` reutilizados). Verificación: nota en este archivo con lo revisado.
  - **Revisión (2026-11-19)**: un solo `COSTO_ENVIO`/`DESCUENTO` (`entities/pedido/model/totales.ts`; el carrito y el resumen lo importan, sin `50` suelto en código de producción); la aritmética de centavos se movió de `cart-store.ts` a `shared/lib/importe.ts` (`aCentavos`, `formatearCentavos`, `sumarImportes`) y la comparten carrito y pedido (las entidades no se importan entre sí); un solo clasificador de errores (`clasificarErrorCreacion`) que consumen el aviso y los tests; reutilizados `SelectorDireccion`, `ResumenDireccion`, `textoPersonalizacion`, `formatearPrecio`, `Campo`, `claseBoton`, `EstadoError`; la búsqueda de una dirección por id (`useDireccionPorId`) y el tamaño de página `TAMANO_LISTA_COMPLETA` quedaron en `entities/direccion` y el selector los usa (antes tenía el 100 privado); `EtiquetaFormaPago`/`BadgeEstado` viven en `entities/pedido/ui` y las usan checkout y confirmación (DRY). SOLID: las páginas solo componen; reglas puras en `model/` con tests; `PasoEntrega`/`PasoFormaPago`/`CampoNotas`/`ResumenPedido`/`AvisoErrorPedido` con una responsabilidad cada una. Sin `any`, sin `vi.mock` de módulos propios.
- [x] 10.3 Docs: `knowledge-base/06_funcionalidades.md` (US-017 marcada), `frontend/README.md` (checkout y confirmación), `CHANGES.md` (cierre de C-19; «Punto de partida (C-19)» en C-20: ruta `/finalizar-compra/pedido/:id/pago` provisoria, `pedidoQueries.detalle`, carrito ya vacío; en C-21: `entities/pedido`, `['pedidos']`; en C-25b: R1–R4 de deuda backend). Verificación: los tres archivos actualizados.

## Workflow follow-up

- Verify visual (design.md §UI Mockups paso 12): backend real + Vite, comparar carrito con CTA, checkout (estados y errores reproducibles) y confirmaciones con los mockups a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-19-fe-checkout-pedido` y marcar `[x]` en `CHANGES.md`.
