# Tasks — C-16b `fe-catalogo-publico`

> **Governance BAJO**: autonomía total si los tests pasan. Gates: (a) los mockups del bloque 0 deben estar aprobados (`design.md` §UI Mockups con `Approval: approved`) antes de escribir código; (b) **C-16a** `backend-catalogo-filtros` debe estar cerrado (el backend ya acepta `precio_min`/`precio_max`/`con_stock` y no duplica resultados). OQ-4..OQ-6 de `design.md` se aplican con su valor por defecto salvo respuesta distinta del usuario. OQ-1..OQ-3 del C-16 original ya están resueltas (decisiones DU-1..DU-3 en el `design.md` de C-16a, referenciadas en D0).
> **Criterios de aceptación visual**: `mockups/catalogo.html`, `catalogo-carga.html`, `catalogo-vacio.html`, `catalogo-filtros.html` y `producto-detalle.html` de este change.
> **Strict TDD** (skills `tdd`, `vitest`, `react-testing`, `tanstack-query`, `feature-sliced-design`): cada tarea de comportamiento es RED → GREEN → TRIANGULATE → REFACTOR, con la suite verde después de cada paso. Red simulada **solo** con MSW (`server.use` por test, `onUnhandledRequest: 'error'`); nunca `vi.mock` de módulos propios. Componentes por lo que el usuario ve (`getByRole` > `getByLabelText` > `getByText`, `userEvent.setup()` con `await`); QueryClient nuevo por test sin reintentos. Valores esperados literales; sin snapshots ni aserciones tautológicas.
> **Hard rules**: FSD con imports hacia abajo (`fsd-boundaries` en cero violaciones); TS `strict` sin `any`; datos del servidor en TanStack Query; no leer ni escribir `.env*`; **no** correr `npm run dev`, `vite build`, `uvicorn` ni servidores (regla 13); no commitear. Este change **no** toca `backend/`. Comandos desde `frontend/`.

## 0. Gate previo (antes de apply)

- [x] 0.1 Crear `mockups/` (catálogo con datos y filtrado, carga, vacío/sin productos/error, hoja de filtros mobile, detalle normal/agotado/no disponible) con `mockup.css`/`mockup.js` copiados de C-15, importando `design-system/tokens.css` y `brand.js`; `README.md` con brief, pantallas y `Approval: pending`.
- [x] 0.2 Renderizar cada mockup a 1440x900 y 390x844 en `mockups/previews/` con headless Edge, inspeccionar las capturas y registrar `Preview: rendered` en `design.md`.
- [ ] 0.3 Mostrar los mockups al usuario y registrar `Approval: approved (<fecha>, by user)` en `design.md` y `mockups/README.md`; registrar también las respuestas (o «por defecto») a OQ-4..OQ-6.

## 1. Red de seguridad

- [ ] 1.1 Safety net frontend: `npm test`, `npm run typecheck`, `npm run lint`; anotar la línea base (archivos/tests verdes al cierre de C-15: 46 / 371) en este archivo. Si algo falla, frenar y reportar como falla previa.
- [ ] 1.2 Verificar el gate (b): `CHANGES.md` con `[x]` en `[C-16a]` y `grep -n "precio_min\|con_stock" backend/app/modules/productos/router.py` con resultados. Si no, frenar y reportar.

## 2. Modelo de la entidad producto (specs «Formato de precio», «Estado de stock visible»)

- [ ] 2.1 RED: `src/entities/producto/__tests__/producto-modelo.test.ts`: `formatearPrecio('12000.00')` → `'$ 12.000'`. Ejecutar → falla.
- [ ] 2.2 GREEN + TRIANGULATE: tipos del contrato y puros en `entities/producto/model/` + `index.ts` (design D1, D5, D8); casos: `'1250.50'` → `'$ 1.250,50'`, `'700.00'` → `'$ 700'`, `'1234567.05'` → `'$ 1.234.567,05'`, `'0.00'` → `'$ 0'`; `estadoStock` 0 → `agotado`, 1 y 5 → `pocas`, 6 → `normal`; `alergenos` devuelve solo los `es_alergeno` en orden; `categoriaPrincipal` (principal, o la primera, o `null`); `imagenPrincipal` (`null` con `imagenes_url` `null` o vacío); `aProductoParaCarrito` → `{productoId, nombre, precioUnitario: '1500.00', imagenUrl}`. Ejecutar → verde.

## 3. Modelo de la entidad categoría (spec «Árbol de categorías»)

- [ ] 3.1 RED: `src/entities/categoria/__tests__/categoria-modelo.test.ts`: `idsDelSubarbol(arbolSeed, 1)` (Hamburguesas con Veganas 4 y Sin TACC 5) → `[1, 4, 5]`. Ejecutar → falla.
- [ ] 3.2 GREEN + TRIANGULATE: `entities/categoria/model/`; casos: hoja → `[id]`; id inexistente → `[]`; tres niveles → incluye nietos; `buscarCategoria` encuentra un nieto y devuelve `undefined` para uno inexistente; `raices` en el orden del servidor. Ejecutar → verde.

## 4. API y consultas (specs «Listado del catálogo», «Datos públicos que sobreviven a la sesión»)

- [ ] 4.1 `src/test/msw/catalogo.ts` (design D12): `productoDto`, `categoriaNodoDto`, `arbolSeed`, `handlersCatalogo(estado)` con filtros, paginación, 404 de id inexistente y registro de URLs. Lo cubren los tests de los bloques 4 a 9 (sin tests propios).
- [ ] 4.2 RED: `src/entities/producto/__tests__/producto-queries.test.tsx` con `renderHook(useQuery(productoQueries.lista({page:1,size:12,categoriaIds:[1,4],precioMin:1000,conStock:true})))`: la query string recibida es exactamente `page=1&size=12&disponible=true&categoria_ids=1&categoria_ids=4&precio_min=1000&con_stock=true` (sin `[]`) y los datos son el `Paginado`. Ejecutar → falla.
- [ ] 4.3 GREEN: `entities/producto/api/` (`listarProductos` con `paramsSerializer: { indexes: null }`, `obtenerProducto`, `productoQueries` según design D2). Ejecutar → verde.
- [ ] 4.4 TRIANGULATE: filtros vacíos → solo `page`, `size`, `disponible`; dos objetos de filtros equivalentes (ids en otro orden) → misma `queryKey`; `detalle(7)` pide `/productos/7`; 404 → `ApiError` `HTTP_404`; mientras carga la página 2 los datos siguen siendo los de la 1 (`isPlaceholderData`); `esConsultaPrivada(['productos','lista',…])` y `(['categorias','arbol'])` → `false`. `entities/categoria/api/` (`obtenerArbolCategorias`, `categoriaQueries.arbol()` con `staleTime` 5 min) con su test: devuelve `data` del servidor. Ejecutar → verde.

## 5. UI de las entidades y agregar al carrito (specs «Imagen…», «Estado de stock visible», «Agregar al carrito»)

- [ ] 5.1 RED: `src/entities/producto/__tests__/tarjeta-producto.test.tsx`: `TarjetaProducto` de «Hamburguesa Clásica» muestra el nombre como enlace a `/catalogo/1`, «Hamburguesas» y «$ 1.500». Ejecutar → falla.
- [ ] 5.2 GREEN + TRIANGULATE: `TarjetaProducto`, `ImagenProducto`, `MarcaStock`, `Precio` (design D8); casos: stock 0 → «Agotado» y la tarjeta marcada como agotada; stock 2 → «Quedan 2»; stock 30 → sin aviso; `imagenes_url` `null` → marcador «Sin imagen de …» y ningún `img`; `fireEvent.error` sobre la imagen → marcador; el slot `accion` se dibuja; el enlace pasa `state.volverA` con la búsqueda actual. axe sin violaciones. Ejecutar → verde.
- [ ] 5.3 RED → GREEN + TRIANGULATE `ArbolCategorias` (`entities/categoria/ui`): `nav` «Categorías», «Todas» primero, subcategorías anidadas en una lista dentro de su padre, la seleccionada con `aria-current`, clic en «Veganas» → `onElegir(4)`, en «Todas» → `onElegir(null)`; axe. Ejecutar → verde.
- [ ] 5.4 RED → GREEN + TRIANGULATE `features/agregar-al-carrito` (`BotonAgregarAlCarrito`, design D10) con el shell real (`renderApp` o un contenedor con `Notificaciones`): clic en «Agregar Hamburguesa Clásica al carrito» → `useCartStore.getState().lineas` tiene `{productoId:1, cantidad:1, precioUnitario:'1500.00', personalizacion:[]}` y se ve «Agregado al carrito»; con `cantidad={3}` suma 3; producto con stock 0 → deshabilitado con texto «Agotado» y sin cambios en el carrito; dos clics → cantidad 2 en una línea. Reiniciar el store entre tests (`reset()`). Ejecutar → verde.
- [ ] 5.5 Fixtures de arquitectura (`tests/architecture/fixtures/`): válido `features/agregar-al-carrito/ui/a.tsx → @/entities/producto` y `@/entities/cart`; inválido `entities/producto/ui/a.tsx → @/entities/cart` (cross-import); lista literal de violaciones esperadas. `npm test -- fsd` → verde y «`src/` real sin violaciones» sigue verde.

## 6. Utilidades compartidas

- [ ] 6.1 RED → GREEN + TRIANGULATE `shared/lib/valor-diferido` (`useValorDiferido`): con timers falsos, «b», «bu», «burger» seguidos → el valor diferido sigue `''` a los 299 ms de la última y es `'burger'` a los 300 ms; un cambio reinicia la espera; al desmontar no queda timer pendiente. Ejecutar → verde.
- [ ] 6.2 Refactor DRY `shared/ui/paginacion` (`Paginacion` con `etiqueta`): mover `PaginacionDirecciones` y usarla desde `pages/direcciones` con `etiqueta="Paginación de direcciones"`. Verificar: los tests de direcciones siguen verdes sin tocarlos; test propio mínimo (una página → nada; página 2 de 3 → ambos botones habilitados y «Página 2 de 3»).
- [ ] 6.3 `Dialogo`: prop opcional `desplazable` (design D7). RED → GREEN: con `desplazable` el cuerpo tiene la clase de scroll y el pie queda fuera de él; sin la prop, `dialogo.test.tsx` sigue verde sin cambios. Ejecutar → verde.
- [ ] 6.4 `shared/config/routes.ts`: `RUTA_PRODUCTO` y `rutaProducto(id)` con test (`rutaProducto(7)` → `'/catalogo/7'`); íconos nuevos del mockup en `shared/ui/icon` (`buscar`, `filtros`, `alerta` si falta, `menos`) con el test de `icon.test.tsx` ampliado. Ejecutar → verde.

## 7. Página «Catálogo»: listado, estados y paginación (specs «Listado…», «Carga, vacío y error…», «Paginación del catálogo», «Datos públicos…»)

- [ ] 7.1 RED: `src/pages/catalogo/__tests__/catalogo-page.test.tsx` con `renderApp('/catalogo')` anónimo y el estado MSW del seed: se ven las tarjetas en orden y el pedido incluye `page=1&size=12&disponible=true`. Ejecutar → falla (hoy se ve la página provisoria).
- [ ] 7.2 GREEN: `pages/catalogo` (página, grilla, estados) y `PAGINAS[RUTAS.catalogo]` en `routes.tsx`. Ejecutar → verde.
- [ ] 7.3 TRIANGULATE: carga demorada → esqueleto con `aria-busy`; `total` 0 sin filtros → «Todavía no hay productos» sin «Limpiar filtros»; 503 → error + «Reintentar» → 200 → tarjetas; 20 productos → «Siguiente» pide `page=2&size=12`, URL `page=2`, «Página 2 de 2» y la grilla anterior visible y atenuada mientras llega; `pages` 1 → sin paginación; región de estado «6 productos»; con sesión `ADMIN` el pedido sigue con `disponible=true`; `CLIENT` cierra sesión → no hay pedido nuevo de productos y las tarjetas siguen. axe sin violaciones con datos. Ejecutar → verde.

## 8. Página «Catálogo»: filtros (specs «Árbol…», «Búsqueda…», «Rango de precio», «Disponibilidad», «Filtros en la dirección…», «Filtros activos…», «Navegación por categorías en mobile»)

- [ ] 8.1 RED: elegir «Hamburguesas» en el árbol → pedido con `categoria_ids=1&categoria_ids=4&categoria_ids=5`, URL `categoria=1` y `aria-current` en «Hamburguesas». Ejecutar → falla.
- [ ] 8.2 GREEN: modelo `pages/catalogo/model/` (`filtrosDesdeUrl`, `filtrosAUrl`, `aParametrosApi`, design D3) con tests unitarios propios (URL válida, `page=-4`, `min=abc`, `min>max`, `stock=1`, `q` con espacios, categoría inexistente con el árbol cargado) y el panel desktop. Ejecutar → verde.
- [ ] 8.3 TRIANGULATE búsqueda (timers falsos): tipear «burger» → 1 pedido con `q=burger` a los 300 ms y URL `q=burger`; vaciar → pedido sin `q`; «Borrar búsqueda» limpia sin esperar; «Atrás» del router restaura el texto del campo. Ejecutar → verde.
- [ ] 8.4 TRIANGULATE precio y stock: 1000/2000 + «Aplicar» → `precio_min=1000&precio_max=2000`, URL `min=1000&max=2000`; 3000/1000 → «El mínimo no puede superar al máximo» y 0 pedidos nuevos; «1,5» → «Ingresá un número entero»; «Solo con stock» → `con_stock=true`, URL `stock=1`; estando en `page=3` cualquier filtro → `page=1`. Ejecutar → verde.
- [ ] 8.5 TRIANGULATE URL y chips: abrir `/catalogo?categoria=2&q=lim&page=2` → pedido con el subárbol de «Bebidas», `q=lim`, `page=2`, campo con «lim»; chips «Bebidas», «"lim"» → «Quitar filtro Bebidas» quita solo ese; con 2+ filtros «Limpiar filtros» → URL `/catalogo`; sin resultados con `q=sushi` → «No encontramos productos» con «sushi» y «Limpiar filtros»; árbol 503 → listado visible + «No pudimos cargar las categorías» + «Reintentar». axe sin violaciones en el estado sin resultados. Ejecutar → verde.
- [ ] 8.6 TRIANGULATE mobile (`setViewport(390)`): chips «Todas», «Bebidas», «Hamburguesas», «Postres» con `aria-pressed`, sin `nav` «Categorías» en la página; «Filtros» abre el diálogo «Filtros» con el árbol completo; elegir «Veganas» → pedido filtrado y el pie dice «Ver N productos»; «Ver resultados» cierra y devuelve el foco a «Filtros»; Escape cierra; el contador de «Filtros» refleja los aplicados. axe con la hoja abierta. Ejecutar → verde.

## 9. Página «Detalle de producto» (specs «Detalle de producto», «Producto inexistente…», «Agregar al carrito»)

- [ ] 9.1 RED: `src/pages/producto/__tests__/producto-page.test.tsx` con `renderApp('/catalogo/1')`: encabezado «Hamburguesa Clásica», «$ 1.500», categorías, descripción e ingredientes con «Alérgeno» en «Pan Brioche» y «Mayonesa» y el resumen «Contiene alérgenos: Pan Brioche, Mayonesa». Ejecutar → falla (ruta inexistente: «Página no encontrada»).
- [ ] 9.2 GREEN: `pages/producto` y la ruta `RUTA_PRODUCTO` en `routes.tsx` con `RequiereAcceso acceso="publica"` (design D9). Ejecutar → verde.
- [ ] 9.3 TRIANGULATE: sin ingredientes → sin sección ni resumen; 404 → «Este producto no está disponible» + enlace «Ver el catálogo» a `/catalogo`; `/catalogo/abc` y `/catalogo/0` → mismo estado y 0 pedidos de producto; 503 → error + «Reintentar»; stock 3 → «Quedan 3», «Sumar una unidad» hasta 3 y luego deshabilitado, «Agregar al carrito» suma 3 y muestra «Agregado al carrito»; stock 0 → «Agotado», sin selector, botón deshabilitado; desde una tarjeta de `/catalogo?categoria=2&page=2`, «Volver al catálogo» vuelve a esa URL; abierto directo, vuelve a `/catalogo`. axe sin violaciones. Ejecutar → verde.
- [ ] 9.4 Integración: desde `/catalogo`, «Agregar Hamburguesa Clásica al carrito» → el contador del carrito del panel muestra 1 (sesión `CLIENT`); anónimo también suma al store. Ejecutar → verde; suite completa, `typecheck` y `lint` limpios.

## 10. Documentación

- [ ] 10.1 `frontend/README.md`: slices nuevos (`entities/producto`, `entities/categoria`, `features/agregar-al-carrito`, `pages/catalogo`, `pages/producto`, `shared/ui/paginacion`, `shared/lib/valor-diferido`), claves `['productos', …]`/`['categorias','arbol']`, `paramsSerializer` para listas, filtros en la URL, `RUTA_PRODUCTO`. Verificar con `ls` que cada path citado existe.
- [ ] 10.2 `knowledge-base/06_funcionalidades.md` US-007/US-008 (frontend cubierto por C-16b; los filtros de precio y stock del backend los agregó C-16a) y `knowledge-base/08_arquitectura_propuesta.md` (árbol FSD real). Verificar con `grep -n "C-16b" knowledge-base/06_funcionalidades.md knowledge-base/08_arquitectura_propuesta.md`.
- [ ] 10.3 `CHANGES.md`: C-18 recibe «Punto de partida (C-16b)» (`TarjetaProducto` con slot `accion`, `BotonAgregarAlCarrito` de `@/features/agregar-al-carrito`, `productoQueries.detalle`, `es_removible` disponible en el detalle, `formatearPrecio`, el carrito no valida stock acumulado: R4). Verificar con `grep -n "Punto de partida (C-16b)" CHANGES.md`.

## Workflow follow-up

- verify (incluye verificación visual contra los mockups aprobados) → `/opsx:archive` y marcar `[x]` C-16b en `CHANGES.md`.
