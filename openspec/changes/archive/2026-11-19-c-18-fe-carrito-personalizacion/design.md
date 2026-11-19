# Design — C-18 `fe-carrito-personalizacion`

## Context

Motivación y alcance: ver `proposal.md`. Requisitos: `specs/frontend-cart`, `specs/frontend-client-stores` y `specs/frontend-catalog` de este change.

Estado de partida relevante (verificado en `dev`, 2026-11-18):

- **`cartStore`** (`src/entities/cart/model/cart-store.ts`): `LineaCarrito = { productoId, nombre, precioUnitario (string decimal), imagenUrl, cantidad, personalizacion: number[] }`; clave de línea `claveLinea(id, ids)`; `persist` con clave `foodstore.cart`, `version: 1`, `partialize` de `lineas` y un `merge` que descarta todo si alguna línea es inválida (`esLineaValida`). Totales en centavos enteros (`aCentavos`). No hay `migrate`.
- **`uiStore`** (`src/shared/model/ui-store.ts`): `cartOpen` sin consumidor; `notificar` y `pedirConfirmacion` (el shell ya dibuja toasts y `ConfirmacionGlobal`).
- **Shell** (`src/app/layouts/app-shell/`): `NavSections` dibuja los ítems desde `seccionesParaRoles`; `Topbar` (mobile) tiene solo «Abrir menú» y el logo. `app-shell.css` **no** portó todavía `.count` ni el `icon-btn` de carrito del design system (`design-system/components.html`: reglas `.count`, `.nav-item .count`, `.icon-btn .count`, panel colapsado; ejemplo de barra superior con carrito).
- **Detalle** (`src/pages/producto/ui/detalle-producto.tsx`): selector de cantidad local (`SelectorCantidad`, en `pages/producto`), botón `BotonAgregarAlCarrito` montado una sola vez según el ancho (barra fija en mobile). Lista de ingredientes con marca «Alérgeno».
- **Router**: `PAGINAS` en `app/router/routes.tsx` mapea ruta → página; `/carrito` cae en `PlaceholderPage` (dueño `C-18`), con guard `sesion`.
- **Backend** (`backend/app/modules/pedidos/service.py`): `personalizacion` del ítem son ids; rechaza duplicados `(producto_id, sorted(personalizacion))`; el snapshot de nombres lo arma con `ingredientes.get_by_id` sin verificar pertenencia al producto ni `es_removible`.

## Goals / Non-Goals

**Goals:**
- Página `/carrito` completa con los estados del mockup, sin pedir nada al servidor (el carrito es estado de cliente, DD-03).
- Personalización en el detalle reutilizando el flujo de agregar existente (anónimo → `/ingresar`).
- Contador de unidades en panel y barra superior mobile con suscripción por *slice*.
- Migración de la persistencia sin perder carritos ya guardados.

**Non-Goals:**
- Llamar al backend desde el carrito (precios o stock actualizados): lo hace C-19 al crear el pedido.
- Drawer lateral de carrito (`cartOpen` queda sin consumidor; ver OQ-1).
- Editar la personalización de una línea ya agregada (OQ-3).
- Tocar `backend/`.

## Decisions

### D1 — Carrito como página `/carrito` (no drawer) — *propuesta, confirmar en OQ-1*
La navegación ya tiene el ítem «Carrito» → `/carrito` con guard `sesion`, el design system dibuja el ícono de carrito de la barra superior como **enlace** (`a.icon-btn`) y en mobile un drawer de carrito competiría con el drawer de navegación (mismo `--z-drawer`, mismo scrim). Una página también es lo que C-19 necesita como punto de partida del checkout.
*Alternativas*: (a) drawer lateral derecho con `uiStore.cartOpen` (rápido para revisar sin salir del catálogo, pero duplica UI y manejo de foco/scrim en mobile); (b) página + drawer de «vista rápida». Se deja `cartOpen` intacto en el store para no romper la spec «Estado de interfaz no persistente».

### D2 — Ubicación FSD
- `entities/cart/model/`: tipos, store v2, `subtotalLinea(linea)` (centavos → string con dos decimales) y el helper puro de presentación `textoPersonalizacion(linea)` → «Sin cebolla, sin tomate» / «Sin 2 ingredientes» / `null`.
- `entities/cart/ui/`: `ContadorCarrito` (badge `.count`, lee `selectTotalItems`). El shell (`app`) puede usarlo porque `app` está arriba de `entities`.
- `features/agregar-al-carrito/ui/`: `SelectorPersonalizacion` (casillas «Sin X»); `BotonAgregarAlCarrito` recibe `excluidos?: readonly { id: number; nombre: string }[]`.
- `pages/carrito/`: `CarritoPage`, `EntradaCarrito` (línea con stepper y «Quitar»), `ResumenCarrito`, `CarritoVacio`, `carrito.css`. Las acciones de línea (`fijarCantidad`, `quitar`, `vaciar`) se usan directo del store desde la página: no hay otro consumidor que justifique un `feature` (FSD: no extraer hasta que se reutilice).
- `entities/producto/model/`: `ingredientesRemovibles(producto)`.
- `shared/ui/selector-cantidad`: el selector «− n +» sale de `pages/producto` con etiquetas parametrizables (`etiquetaRestar`/`etiquetaSumar`) para que el detalle («Restar una unidad») y el carrito («Restar una unidad de Hamburguesa Clásica») usen el mismo componente (reglas duras 3 y 5: no duplicar). Los tests existentes del detalle siguen verdes sin cambios de texto.

### D3 — Nombres de exclusiones en la línea y persistencia v2 — *propuesta, confirmar en OQ-2*
La línea agrega `personalizacionNombres: string[]` (mismo orden que `personalizacion`, ordenada por id). Se guarda al agregar (snapshot, como ya hacen `nombre`, `precioUnitario` e `imagenUrl`), así el carrito se dibuja sin N consultas de detalle y funciona aunque el producto cambie o se dé de baja. `agregar(producto, cantidad, excluidos)` normaliza (sin repetidos por id, orden por id) y deriva ambos arrays; sumar a una línea existente conserva los nombres originales.
Se mantiene `personalizacion: number[]` con ese nombre: es lo que C-19 envía como `items[].personalizacion` (contrato `POST /pedidos/`).
**Firma**: el tercer parámetro de `agregar` pasa de `readonly number[]` a `readonly { id: number; nombre: string }[]`. Los únicos llamadores son `BotonAgregarAlCarrito` (hoy sin personalización) y los tests del store, que se actualizan.
**Persistencia**: `version: 2` con `migrate(guardado, version)`: desde 1, cada línea recibe `personalizacionNombres: []`; luego `merge` valida como hoy, con una regla nueva: `personalizacionNombres` es un array de strings y, si no está vacío, tiene el mismo largo que `personalizacion`. Una línea v1 con ids y sin nombres se muestra «Sin N ingredientes» (en la práctica no existe: C-16b nunca agregó personalizado).
*Alternativas*: (a) solo ids y consultar `productoQueries.detalle(id)` por línea (siempre fresco, pero N pedidos, estados de carga por línea y roto si el producto se dio de baja); (b) cambiar a `excluidos: {id, nombre}[]` (más limpio, pero rompe el nombre `personalizacion` que espera C-19 y la spec actual).

### D4 — Cómo se distinguen las líneas personalizadas
Lo resuelve el store: clave `<productoId>:<ids ordenados>`. En la UI cada línea es una entrada propia con el subtítulo de `textoPersonalizacion` (el `small` del `.cartitem`, como en `components.html`: «Sin cebolla»). Formato: «Sin» con mayúscula, nombres en minúscula, separados por «, sin » («Sin cebolla, sin tomate»). Una línea sin exclusiones no tiene subtítulo. La `key` de React es la clave de línea. Cuando dos entradas comparten producto, el nombre accesible de sus acciones incluye la personalización («Quitar Hamburguesa Clásica sin cebolla») para que no se repitan.

### D5 — Selector de personalización en el detalle
Sección «Personalizá tu pedido» (`fieldset` + `legend`) entre la descripción y la compra, con una casilla por `ingredientesRemovibles(producto)` en el orden del servidor, etiqueta «Sin <Nombre>». Estado local del detalle (conjunto de ids), pasado a `BotonAgregarAlCarrito` como `excluidos`. Se oculta sin removibles o con el producto agotado. Tras agregar, las casillas **se mantienen** (permite sumar otra igual; ver OQ-6). En mobile la sección queda en el flujo de la página y el botón en la barra fija, como hoy.
Sin sesión el botón sigue llevando a `/ingresar` y la personalización elegida se pierde al volver (aceptado; R5).
*Alternativa*: modal u hoja «Personalizar» al pulsar «Agregar» en la tarjeta del catálogo (más pasos y otro componente; la tarjeta sigue agregando «tal cual»).

### D6 — Cantidades en el carrito
Stepper compartido (D2) con mínimo 1 (el «−» se deshabilita; quitar es una acción explícita) y máximo **99** como tope de la UI (el store sigue aceptando cualquier entero ≥ 1; ver OQ-7). Sin campo de texto libre (como el detalle). No se valida contra stock (R4 de C-16b; lo valida el backend al crear el pedido, C-19). La cantidad usa `output` con `aria-live="polite"`.

### D7 — Quitar y vaciar
«Quitar» elimina la línea sin confirmación y muestra el toast `info` «Quitado del carrito» con el nombre (fácil de rehacer). «Vaciar carrito» usa `pedirConfirmacion` con `variante: 'peligro'`, título «¿Vaciar el carrito?», botones «Vaciar» y «Cancelar».
*Alternativa*: toast con «Deshacer» (los toasts del design system no tienen acción; se descarta).

### D8 — Resumen y CTA
Resumen: «N unidades» (`selectTotalItems`) y «Total» (`selectTotalPrecio` + `formatearPrecio`), con la nota «El envío y los precios finales se confirman al crear el pedido» (el backend suma `costo_envio` y toma el precio vigente). **Sin botón de checkout** hasta C-19 (ver OQ-5). En desktop el resumen va en una columna lateral `sticky`; en mobile, debajo de la lista.

### D9 — Contador en la navegación
`ItemNav` no cambia; `NavSections` dibuja `ContadorCarrito` cuando `item.id === 'carrito'`, y el nombre accesible del enlace pasa a «Carrito, N productos» cuando N > 0. Se cuentan **unidades** (`selectTotalItems`; ver OQ-4). `Topbar` recibe `mostrarCarrito` (verdadero si la navegación calculada incluye `carrito`, o sea con sesión) y dibuja un `Link` `icon-btn` a `/carrito` con el contador, a la derecha como en `components.html`. Se portan a `app-shell.css` las reglas `.count` del design system (ítem, panel colapsado, `icon-btn`). El número no se anima.

### D10 — Tests (Strict TDD)
- Store: Vitest puro sobre `useCartStore` (nombres, migración v1 → v2 escribiendo el JSON v1 en `localStorage` y llamando `persist.rehydrate()`, validación de largo, `subtotalLinea`).
- Helpers puros: `textoPersonalizacion`, `ingredientesRemovibles`.
- Componentes y páginas: RTL con `renderApp('/carrito', { sesion })` y el carrito precargado con `useCartStore.setState`; detalle con MSW (`montarCatalogo('/catalogo/1')`); axe en carrito con datos, vacío y detalle con personalización. Sin `vi.mock` de módulos propios; `userEvent.setup()`.
- Contador: tests del shell con sesión (panel expandido/colapsado y barra superior mobile con `matchMedia` simulado como en `catalogo-mobile.test.tsx`).

## Risks / Trade-offs

- **R1 [Precio desactualizado]** El carrito muestra el precio del momento de agregar; el backend cobra el vigente. → Nota visible en el resumen (D8); C-19 muestra el total del pedido creado.
- **R2 [Stock acumulado]** Se pueden sumar más unidades que el stock (hasta 99). → Aceptado (R4 de C-16b); `INSUFFICIENT_STOCK` al crear el pedido (C-19).
- **R3 [Producto dado de baja o no disponible]** Una línea puede referirse a un producto que ya no se vende. → C-19 recibe el 404/400 al crear el pedido y debe indicar qué línea quitar; este change no consulta el servidor.
- **R4 [Backend no valida la personalización]** `POST /pedidos/` acepta ids de ingredientes que no son removibles o no son del producto. → El frontend solo ofrece removibles del producto; se registra como deuda backend para C-19/C-25b (no se toca `backend/` aquí).
- **R5 [Personalización perdida al iniciar sesión]** El visitante anónimo que marcó exclusiones y pulsó «Agregar» vuelve al detalle sin ellas. → Aceptado (coherente con OQ-5 de C-16b: el producto no se agrega solo).
- **R6 [Cambio de firma de `agregar`]** → Un solo llamador de producción; lo cubren los tests existentes del store y del botón.

## Migration Plan

Sin migración de esquema ni backend. Persistencia del navegador: `foodstore.cart` v1 → v2 por `migrate` (D3), sin perder líneas. Rollback: revertir el commit; un carrito ya guardado en v2 sería descartado por el código v1 (versión desconocida → vacío), aceptable en desarrollo.

## Open Questions

> Governance MEDIO. Cada pregunta tenía una **propuesta por defecto** que ya reflejan las specs y las tareas. El usuario aceptó **todos los defectos el 2026-11-19** (OQ-1..OQ-7 resueltas); specs, mockups y tareas ya son consistentes con ellos.

- **OQ-1 — ¿Página o drawer?** Defecto: **página `/carrito`** (D1). Alternativas: drawer lateral (usa `cartOpen`) o ambos. **RESUELTA (2026-11-19, por el usuario): página `/carrito`, sin drawer (defecto aceptado).**
- **OQ-2 — Nombres de exclusiones guardados en la línea (persistencia v2)** vs. consultarlos al servidor. Defecto: **guardarlos** (D3). **RESUELTA (2026-11-19, por el usuario): guardar los nombres en la línea (persistencia v2) (defecto aceptado).**
- **OQ-3 — ¿Editar la personalización desde el carrito?** Defecto: **no**; se quita y se vuelve a agregar desde el detalle (el nombre de la línea enlaza a `/catalogo/:id`). Editar en el carrito obligaría a fusionar líneas cuando la nueva personalización coincide con otra existente. **RESUELTA (2026-11-19, por el usuario): no se edita la personalización desde el carrito (defecto aceptado).**
- **OQ-4 — ¿El contador cuenta unidades o líneas?** Defecto: **unidades** (`selectTotalItems`; 2 hamburguesas + 1 gaseosa = 3), como el `aria-label` «3 productos» del design system. **RESUELTA (2026-11-19, por el usuario): el contador cuenta unidades (defecto aceptado).**
- **OQ-5 — CTA de checkout en C-18.** Defecto: **ninguno** hasta C-19 (no existe la ruta). Alternativa: botón «Continuar» deshabilitado con aviso. **RESUELTA (2026-11-19, por el usuario): sin botón de checkout hasta C-19 (defecto aceptado).**
- **OQ-6 — ¿Las casillas de personalización se limpian tras agregar?** Defecto: **se mantienen**. Alternativa: volver a «tal cual» tras cada agregado. **RESUELTA (2026-11-19, por el usuario): las casillas se mantienen tras agregar (defecto aceptado).**
- **OQ-7 — Tope de cantidad por línea en el carrito.** Defecto: **99** (D6). Alternativa: sin tope. **RESUELTA (2026-11-19, por el usuario): tope de 99 por línea (defecto aceptado).**

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/c-18-fe-carrito-personalizacion/mockups/` (`carrito.html`, `carrito-vacio.html`, `producto-personalizar.html`, `navegacion-contador.html`, `README.md`, `previews/`)
- Approval: approved (2026-11-19, by user)
- Preview: rendered (2026-11-19, mockups/previews/)
- Visual verify: passed (2026-11-19) — sin blockers ni majors; los 3 hallazgos menores de UI se corrigieron y re-verificaron el mismo día (capturas regeneradas); capturas en `mockups/verify/` (1440x900 y 390x844, backend real + Vite, Edge con playwright-core). Diferencias menores:
  - Imágenes: el seed usa placeholders grises y la Coca-Cola el respaldo; los mockups usaban ilustraciones (datos, no UI).
  - Nota de envío del resumen: la app muestra un ícono de advertencia que el mockup no tenía.
  - CORREGIDO: Mobile: «Vaciar carrito» quedaba alineado a la izquierda con sangría extra; ahora ocupa el ancho completo (`.btn-vaciar`).
  - CORREGIDO: Mobile: un toast «Quitado del carrito» tapaba «Cancelar» de la hoja «¿Vaciar el carrito?»; el diálogo modal (z-index 70) ahora queda sobre los toasts (60).
  - CORREGIDO: «Seguir comprando» ahora va subrayado como en el mockup.
  - Único error de consola: `/favicon.ico` 404 (preexistente, no es de C-18).
  - No verificado: estado de línea migrada «Sin 2 ingredientes» (cubierto por tests) y drawer de navegación mobile.

Pantallas y estados a cubrir (cada uno a 1440x900 y 390x844):

| Estado | Mockup previsto |
|--------|-----------------|
| Carrito con varias líneas: una personalizada («Sin cebolla, sin tomate»), la misma hamburguesa sin personalizar en otra línea, una sin imagen; stepper con «−» deshabilitado en cantidad 1; resumen (unidades, total, nota de envío y precios) en columna lateral (desktop) / debajo (mobile); «Vaciar carrito» | `carrito.html` |
| Diálogo «¿Vaciar el carrito?» abierto | `carrito.html?estado=vaciar` |
| Toast «Quitado del carrito» tras quitar una línea | `carrito.html?estado=quitado` |
| Línea migrada sin nombres («Sin 2 ingredientes») | `carrito.html?estado=sin-nombres` |
| Carrito vacío («Tu carrito está vacío», «Ver catálogo») | `carrito-vacio.html` |
| Detalle con «Personalizá tu pedido» (removibles, uno alérgeno, una casilla marcada), cantidad y «Agregar al carrito»; en mobile la sección en el flujo y la barra de compra fija | `producto-personalizar.html` |
| Toast «Agregado al carrito — 1 × Hamburguesa Clásica, sin cebolla» | `producto-personalizar.html?estado=agregado` |
| Contador en la navegación: panel expandido con «Carrito 3», panel colapsado con badge, barra superior mobile con botón de carrito y badge; variante con carrito vacío (sin número) | `navegacion-contador.html` (`?nav=collapsed`, `?carrito=vacio`) |
