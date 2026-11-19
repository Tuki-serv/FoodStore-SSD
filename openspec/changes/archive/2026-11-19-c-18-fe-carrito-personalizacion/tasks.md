# Tasks — C-18 `fe-carrito-personalizacion`

> **Governance MEDIO**: implementar por bloques con checkpoints; las decisiones no obvias se reportan al usuario. Gate: los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) y las respuestas a OQ-1..OQ-7 registradas antes de escribir código. Si una respuesta difiere del defecto, se ajustan specs, mockups y estas tareas antes del bloque 1.
> **Criterios de aceptación visual**: `mockups/carrito.html`, `carrito-vacio.html`, `producto-personalizar.html` y `navegacion-contador.html` de este change.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `zustand`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Red simulada solo con MSW (`onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()` con `await`). Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; el carrito es estado de cliente (Zustand), los productos son datos del servidor (TanStack Query); no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build` ni servidores (regla 13); no commitear. No se toca `backend/`. Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` con los estados de la tabla de `design.md` §UI Mockups (`carrito.html` con `?estado=vaciar|quitado|sin-nombres`, `carrito-vacio.html`, `producto-personalizar.html` con `?estado=agregado`, `navegacion-contador.html` con `?nav=collapsed` y `?carrito=vacio`), `mockup.css`/`mockup.js` copiados de C-16b, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`. Verificación: los archivos existen y abren desde `file://`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/`, inspeccionar las capturas, corregir defectos y registrar `Preview: rendered (<fecha>, …)` en `design.md`. Verificación: capturas presentes y listadas.
- [x] 0.3 Mostrar los mockups y las preguntas OQ-1..OQ-7 al usuario; registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md` y la respuesta (o «por defecto») de cada OQ en `design.md`. Verificación: ambos archivos con la aprobación y las OQ resueltas.

## 1. Red de seguridad

- [x] 1.1 Ejecutar `npm test`, `npm run typecheck` y `npm run lint`; anotar acá la línea base (archivos/tests verdes). Si algo falla, frenar y reportarlo como falla previa.
  - Línea base (2026-11-19): 87 archivos, 780 tests verdes; typecheck y lint limpios.

## 2. Store del carrito: nombres de exclusiones, subtotal y persistencia v2 (spec `frontend-client-stores`)

- [x] 2.1 RED: en `src/entities/cart/__tests__/cart-store.test.ts`, agregar el producto 7 con excluidos `[{id:3,nombre:'Tomate'},{id:1,nombre:'Cebolla'}]` → la línea tiene `personalizacion` `[1, 3]` y `personalizacionNombres` `['Cebolla','Tomate']`. Ejecutar → falla.
- [x] 2.2 GREEN + TRIANGULATE: nueva firma de `agregar` y campo `personalizacionNombres` (design D3). Casos: ids repetidos se deduplican; sumar a una línea existente con otro nombre conserva el original; sin excluidos → ambos arrays vacíos; los tests previos (mismo producto con `[3,1]` y `[1,3]` en una línea; otra personalización → otra línea) adaptados a la nueva firma y verdes. Actualizar `BotonAgregarAlCarrito` a la firma nueva sin cambiar su comportamiento (sus tests siguen verdes). Ejecutar → verde.
- [x] 2.3 RED → GREEN + TRIANGULATE `subtotalLinea`: 3 × «0.10» → «0.30»; 2 × «1500.00» → «3000.00»; 1 × «1250.50» → «1250.50». Ejecutar → verde.
- [x] 2.4 RED: con `localStorage['foodstore.cart']` en formato v1 (`{state:{lineas:[{…, personalizacion:[1], cantidad:2}]}, version:1}`) y `useCartStore.persist.rehydrate()`, la línea se conserva con `personalizacionNombres: []`. Ejecutar → falla.
- [x] 2.5 GREEN + TRIANGULATE: `version: 2`, `migrate` desde 1 y validación nueva en `merge` (design D3). Casos: v2 válido se recupera igual; línea con 2 ids y 3 nombres → carrito vacío; nombres no string → carrito vacío; JSON corrupto → carrito vacío (test previo verde); versión desconocida (99) → carrito vacío. Ejecutar → verde.
- [x] 2.6 REFACTOR: exportar por `src/entities/cart/index.ts` lo nuevo (`subtotalLinea`, tipo de excluido); suite, typecheck y lint verdes.

## 3. Helpers puros de presentación

- [x] 3.1 RED → GREEN + TRIANGULATE `textoPersonalizacion(linea)` en `entities/cart/model`: `['Cebolla','Tomate']` → «Sin cebolla, sin tomate»; un nombre → «Sin cebolla»; sin exclusiones → `null`; 2 ids sin nombres → «Sin 2 ingredientes»; 1 id sin nombre → «Sin 1 ingrediente». Ejecutar → verde.
- [x] 3.2 RED → GREEN + TRIANGULATE `ingredientesRemovibles(producto)` en `entities/producto/model`: devuelve solo los `es_removible` en el orden del servidor; sin ingredientes → `[]`; un alérgeno removible se incluye. Ejecutar → verde.

## 4. Selector de cantidad compartido

- [x] 4.1 Mover `SelectorCantidad` de `pages/producto/ui` a `shared/ui/selector-cantidad` con etiquetas parametrizables (`etiquetaRestar`, `etiquetaSumar`, por defecto «Restar una unidad» / «Sumar una unidad») y exportarlo desde `@/shared/ui`; el detalle lo importa de ahí. Verificación: los tests del detalle (`pages/producto/__tests__`) siguen verdes sin cambios; RED → GREEN de un test propio en `shared/ui/selector-cantidad/__tests__`: con `max` 99 y valor 99 «Sumar…» deshabilitado; con valor 1 «Restar…» deshabilitado; etiquetas personalizadas visibles como nombres accesibles.

## 5. Personalización en el detalle (spec `frontend-catalog`)

- [x] 5.1 RED: en `src/pages/producto/__tests__/producto-personalizacion.test.tsx` (MSW, `montarCatalogo('/catalogo/1')` con sesión `CLIENT`), el detalle de «Hamburguesa Clásica» con «Cebolla» y «Tomate» removibles y «Pan Brioche» no removible muestra el grupo «Personalizá tu pedido» con las casillas «Sin Cebolla» y «Sin Tomate» sin marcar y ninguna «Sin Pan Brioche». Ejecutar → falla.
- [x] 5.2 GREEN: `SelectorPersonalizacion` en `features/agregar-al-carrito/ui` y su uso en `DetalleProducto` (design D5). Ejecutar → verde.
- [x] 5.3 TRIANGULATE: producto sin removibles → sin la sección; stock 0 → sin la sección; marcar «Sin Cebolla» y pulsar «Agregar al carrito» → línea con `personalizacion` `[id de cebolla]` y nombre «Cebolla», toast «1 × Hamburguesa Clásica, sin cebolla»; repetir con la misma casilla → misma línea con cantidad 2; desmarcar y agregar → segunda línea sin exclusiones; las casillas siguen marcadas tras agregar (OQ-6); alérgeno removible: casilla visible y sigue en «Contiene alérgenos»; sin sesión con una casilla marcada → `/ingresar` y carrito vacío; en mobile (`matchMedia`) la sección se ve y hay un solo botón «Agregar al carrito»; axe sin violaciones con una casilla marcada. Ejecutar → verde.
- [x] 5.4 Tarjeta del catálogo: test existente «Agregar desde la tarjeta» extendido para afirmar que la línea no tiene exclusiones. Ejecutar → verde.

## 6. Página del carrito (spec `frontend-cart`)

- [x] 6.1 RED: `src/pages/carrito/__tests__/carrito-page.test.tsx` con `renderApp('/carrito', { sesion: { roles: ['CLIENT'] } })` y el carrito precargado (2 × «Hamburguesa Clásica» `"1500.00"`, 1 × «Coca-Cola 500ml» `"800.00"`): encabezado «Carrito», dos entradas en ese orden con «$ 3.000» y «$ 800», resumen «3 unidades» y «$ 3.800». Ejecutar → falla.
- [x] 6.2 GREEN: `pages/carrito/` (`CarritoPage`, `EntradaCarrito`, `ResumenCarrito`, `carrito.css`, `index.ts`), entrada en `PAGINAS` de `app/router/routes.tsx` y `@import` del CSS junto a los demás en `app/styles/index.css` (antes de cualquier regla; lo verifica `tests/architecture/styles-compile.test.ts`). Ejecutar → verde.
- [x] 6.3 TRIANGULATE personalización visible: misma hamburguesa en dos líneas (sin «Cebolla» y «Tomate» / sin exclusiones) → dos entradas, una con «Sin cebolla, sin tomate» y otra sin subtítulo, con nombres accesibles de acciones distintos (design D4); línea con 2 ids sin nombres → «Sin 2 ingredientes»; imagen `null` → respaldo de imagen. Ejecutar → verde.
- [x] 6.4 RED → GREEN + TRIANGULATE cantidades: «Sumar una unidad de Hamburguesa Clásica» pasa 2 → 3 y actualiza subtotal «$ 4.500» y total; «Restar…» deshabilitado en 1; «Sumar…» deshabilitado en 99; la cantidad se anuncia (`output`). Ejecutar → verde.
- [x] 6.5 RED → GREEN + TRIANGULATE quitar: «Quitar Hamburguesa Clásica sin cebolla» elimina solo esa línea y muestra «Quitado del carrito»; quitar la última línea muestra el estado vacío. Ejecutar → verde.
- [x] 6.6 RED → GREEN + TRIANGULATE vaciar: «Vaciar carrito» abre «¿Vaciar el carrito?»; «Vaciar» deja el carrito vacío y el estado vacío visible; «Cancelar» conserva las líneas. Ejecutar → verde.
- [x] 6.7 RED → GREEN carrito vacío: «Tu carrito está vacío», enlace «Ver catálogo» a `/catalogo`, sin «Vaciar carrito» ni resumen. TRIANGULATE: sin sesión `/carrito` → `/ingresar` con `/carrito` recordada (guard existente). Ejecutar → verde.
- [x] 6.8 axe sin violaciones en el carrito con dos líneas (una personalizada) y en el vacío; nota «El envío y los precios finales se confirman al crear el pedido» visible. Ejecutar → verde.

## 7. Contador del carrito en la navegación (spec `frontend-cart`, «Contador del carrito en la navegación»)

- [x] 7.1 RED: en `src/app/layouts/app-shell/__tests__/contador-carrito.test.tsx`, con sesión `CLIENT` y el carrito vacío, agregar 2 unidades → el enlace «Carrito, 2 productos» muestra «2». Ejecutar → falla.
- [x] 7.2 GREEN: `ContadorCarrito` en `entities/cart/ui` (+ export), uso en `NavSections` y reglas `.count` portadas a `app-shell.css` (design D9). Ejecutar → verde.
- [x] 7.3 TRIANGULATE: carrito vacío → enlace «Carrito» sin número; panel colapsado → badge visible y nombre accesible «Carrito, N productos»; mobile (`matchMedia` < 1024) → botón «Carrito, 3 productos» en la barra superior que lleva a `/carrito`; sin sesión → sin botón de carrito en la barra superior; el contador se actualiza al cambiar cantidades en `/carrito`. Ejecutar → verde.

## 8. Cierre

- [x] 8.1 `npm test`, `npm run typecheck`, `npm run lint` verdes; `fsd-boundaries` sin violaciones; anotar el total de tests contra la línea base del 1.1.
  - Resultado (2026-11-19): 92 archivos, 848 tests verdes (línea base 87 / 780: +5 archivos, +68 tests); typecheck y lint limpios; `fsd-boundaries` y `styles-compile` verdes.
- [x] 8.2 Revisión SOLID/DRY del diff (sin duplicar el stepper ni la lógica de centavos; `aCentavos` reutilizado por `subtotalLinea`). Verificación: nota en este archivo con lo revisado.
  - Revisado: `SelectorCantidad` único (detalle y carrito); `aCentavos` y `formatearCentavos` compartidos por `subtotalLinea` y `selectTotalPrecio`; `claveLinea` usada como `key` de las entradas; `etiquetaCarrito` única fuente del nombre accesible (panel y barra superior); reglas `.opt` reutilizadas de `direccion.css`. Sin lógica de negocio en páginas (cantidades/quitar/vaciar delegan en el store).
- [x] 8.3 Docs: `knowledge-base/06_funcionalidades.md` (US-015, US-016 marcados), `knowledge-base/08_arquitectura_propuesta.md` (fila `cartStore`: v2 con `personalizacionNombres`), `frontend/README.md` (página del carrito), `CHANGES.md` («Punto de partida (C-18)» en C-19: página `/carrito`, `personalizacion` + `personalizacionNombres`, `subtotalLinea`, riesgo R4 de validación backend, sin CTA de checkout). Verificación: los cuatro archivos actualizados.

## Workflow follow-up

- Verify visual (design.md §UI Mockups paso 12): backend real + Vite, comparar `/carrito`, el detalle personalizado y el contador con los mockups a 1440x900 y 390x844; registrar `Visual verify`.
- `/opsx:archive c-18-fe-carrito-personalizacion` y marcar `[x]` en `CHANGES.md`.
