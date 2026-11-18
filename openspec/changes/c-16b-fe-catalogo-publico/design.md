# Design — C-16b `fe-catalogo-publico`

## Context

Motivación y estado observado: ver `proposal.md` (Why). C-16b es la parte frontend de C-16 (partido el 2026-11-18); la parte backend es **C-16a** `backend-catalogo-filtros` (`openspec/changes/c-16a-backend-catalogo-filtros/`), de la que este change depende. Restricciones que condicionan el diseño:

- **Backend (C-16a)**: `GET /productos/` acepta `precio_min`, `precio_max` (≥ 0; `min > max` → 422 `VALIDATION_ERROR` `field` `precio_max`) y `con_stock`, y no duplica productos al filtrar por varias `categoria_ids`/`ingrediente_ids` (`EXISTS`). Las decisiones del usuario que lo motivan (ex OQ-1..OQ-3) están en el `design.md` de C-16a como DU-1..DU-3.
- **Frontend base (C-13a + C-13b + C-15)**: FSD v2.1 (`app` → `pages` → `features` → `entities` → `shared`) verificado por `tests/architecture/fsd-boundaries.test.ts` (sin cross-imports entre slices de la misma capa); `apiClient`, `ApiError`, `Paginado<T>` y `CLAVES_PUBLICAS` (`productos`, `categorias` ya listadas) en `@/shared/api`; `useCartStore.agregar(producto, cantidad, personalizacion)` en `@/entities/cart` (precio como string decimal, valida `^\d+(\.\d{1,2})?$`); `notificar` en `uiStore` y los hosts de notificación/confirmación montados en el shell (C-15); `Dialogo`, `Campo`, `Icon`, `claseBoton`, `useMediaQuery` en `@/shared/ui`/`@/shared/lib`; `PAGINAS` en `routes.tsx`; `renderApp`, MSW con `onUnhandledRequest: 'error'` y `esperarSinViolacionesA11y` para tests.
- **`/catalogo`** es pública (`ACCESO_RUTAS`), es el destino de `/` y hoy muestra `PlaceholderPage` (dueño `C-16b` en `route-map.ts`). No existe ruta de detalle.
- **Reglas duras**: TS estricto sin `any`; datos del servidor en TanStack Query, Zustand solo cliente; no levantar servidores; TDD estricto; la spec manda sobre el código; ningún cambio de esquema sin Alembic (acá no hay).

### Contrato del backend (verificado 2026-11-18; con C-16a aplicado)

| Método y ruta | Parámetros | Respuesta | Notas |
|---------------|-----------|-----------|-------|
| `GET /api/v1/productos/` | `page` ≥ 1, `size` 1..100 (defecto 20), `q`, `categoria_ids` (repetido), `ingrediente_ids` (repetido), `disponible`, `estado`; **C-16a**: `precio_min`, `precio_max`, `con_stock` | 200 `Paginado<ProductoReadFull>`, orden `id` ascendente | Público. Anónimo/CLIENT/PEDIDOS: solo `disponible = true` y no eliminados. ADMIN/STOCK ven no disponibles si no envían `disponible`. `q` solo busca en `nombre` (`ILIKE %q%`). Hoy (sin C-16a) no hay filtro de precio ni de stock y se duplican filas con varios `categoria_ids`/`ingrediente_ids` (JOIN sin `DISTINCT`); C-16a lo corrige |
| `GET /api/v1/productos/{id}` | — | 200 `ProductoReadFull` | 404 si no existe, está eliminado o (para el público) no disponible; 422 si `id` < 1 |
| `GET /api/v1/categorias/arbol` | — | 200 `{data: CategoriaTreeNode[], total}` | Público, solo activas, ordenado por nombre en cada nivel; sin conteo de productos |

- `ProductoReadFull`: `{id, nombre, descripcion|null, unidad_venta_id|null, precio_base: "1500.00", imagenes_url: string[]|null, imagenes_public_id, stock_cantidad: int, disponible: bool, categorias: [{id, nombre, es_principal}], ingredientes: [{id, nombre, es_alergeno, es_removible, cantidad: "1.000", unidad_medida_id}]}` (Decimal → string en JSON, Pydantic v2).
- `CategoriaTreeNode`: `{id, parent_id, nombre, descripcion, imagen_url, imagen_public_id, subcategorias: CategoriaTreeNode[]}`.
- Un access inválido en una lectura pública responde 401 (`catalog-visibility`); el cliente HTTP ya lo renueva o cierra la sesión local y la consulta se reintenta (C-13b).
- Seed: raíces «Bebidas» (hija «Gaseosas»), «Hamburguesas» (hijas «Sin TACC», «Veganas»), «Postres»; 6 productos de $ 700 a $ 1.900; «Burger Vegana» y «Burger Sin TACC» en dos categorías; imágenes `via.placeholder.com` (externas, pueden fallar) o `null`.

**KB ↔ backend**: US-007 pide filtro de rango de precio y de disponibilidad que el backend no tenía: lo agrega C-16a (DU-1, DU-2); RN-PR-03 coincide (visibilidad); RN-PR-04 (alérgenos como badge) se cubre con `es_alergeno` del detalle; el comentario del router dice «buscar en nombre o descripción», pero el código y la KB («nombre, búsqueda parcial») usan solo `nombre`: se respeta la KB (C-16a corrige el texto del OpenAPI).

## Goals / Non-Goals

**Goals:**
- Un único lugar del frontend que conoce el contrato de productos y categorías (tipos, llamadas, claves), reutilizable por C-17b (admin) y C-18 (carrito).
- Filtros como estado de la URL: compartibles, restaurables con «Atrás» y sin estado duplicado en Zustand.
- Tarjeta y botón de agregar reutilizables por C-18.
- Todo probado sin backend (MSW en el borde) y con revisión automática de accesibilidad; el MSW imita el contrato de C-16a (los cambios de backend se prueban con pytest en C-16a).

**Non-Goals:**
- Ordenamiento, filtro por ingredientes en la UI, galería de imágenes, scroll infinito (ver D6).
- Personalización de ingredientes y validación del carrito contra el stock (C-18/C-19).
- Cambiar la visibilidad del catálogo (`catalog-visibility`).
- Cualquier cambio de backend (filtros de precio/stock, duplicados): es C-16a.

## Decisions

### D0 — Decisiones del usuario heredadas de C-16a (2026-11-18)

Ex OQ-1..OQ-3 del C-16 original, resueltas por el usuario y registradas en `openspec/changes/c-16a-backend-catalogo-filtros/design.md` (DU-1..DU-3):

- **DU-1**: el rango de precio se filtra en el backend (`precio_min`/`precio_max`); la UI lo ofrece (D5).
- **DU-2**: «disponibilidad» para el público es «Solo con stock» (`con_stock=true`), con soporte en el backend.
- **DU-3**: el backend no duplica resultados y el frontend envía la categoría elegida **más todas sus subcategorías** (`idsDelSubarbol`, D3).

### D1 — Ubicación FSD

| Pieza | Ubicación | Por qué |
|-------|-----------|---------|
| Tipos `Producto`, `IngredienteProducto`, `CategoriaDeProducto`; puros `formatearPrecio(decimal)`, `estadoStock(stock)` (`'agotado' \| 'pocas' \| 'normal'`), `alergenos(producto)`, `categoriaPrincipal(producto)`, `imagenPrincipal(producto)`, `aProductoParaCarrito(producto)` | `entities/producto/model/` | Dominio «producto» con 3+ consumidores (catálogo, detalle, C-17b, C-18) |
| `listarProductos(filtros)`, `obtenerProducto(id)`, `productoQueries` | `entities/producto/api/` | CRUD/lectura de la entidad (la skill FSD lo admite en `api/` de la entidad) |
| `TarjetaProducto` (con slot `accion`), `ImagenProducto` (respaldo ante `null`/`onError`), `MarcaStock`, `Precio` | `entities/producto/ui/` | UI de la entidad; la tarjeta no importa el carrito (otra entidad): recibe el botón por prop |
| Tipo `CategoriaNodo`; puros `idsDelSubarbol(arbol, id)`, `buscarCategoria(arbol, id)`, `raices(arbol)` | `entities/categoria/model/` | Lo reutiliza C-17a (selector de padre) |
| `obtenerArbolCategorias()`, `categoriaQueries.arbol()` | `entities/categoria/api/` | Lectura pública de la entidad |
| `ArbolCategorias` (navegación con `seleccionada`/`onElegir`, «Todas» primero) | `entities/categoria/ui/` | Presentación del árbol sin estado propio; lo usa el panel desktop y la hoja mobile |
| `BotonAgregarAlCarrito` (llama a `useCartStore.agregar` + `notificar`) | `features/agregar-al-carrito/` | Interacción de usuario que combina dos entidades (`producto` + `cart`) y tiene 2 consumidores hoy (catálogo, detalle) y un tercero en C-18; `features` es la capa que puede importar ambas |
| Página, panel de filtros, chips, hoja mobile, estados; `filtrosDesdeUrl`, `filtrosAUrl`, `aParametrosApi`, `validarRangoPrecio` | `pages/catalogo/` (`ui/`, `model/`) | Un consumidor: «empezar simple» |
| Página de detalle y selector de cantidad | `pages/producto/` | Un consumidor |
| `Paginacion` (extraída de `PaginacionDirecciones` con `etiqueta` para `aria-label`) | `shared/ui/paginacion/` | Segundo consumidor (direcciones + catálogo): se abstrae (DRY); direcciones pasa a usarla sin cambiar su comportamiento |
| `useValorDiferido(valor, ms)` | `shared/lib/valor-diferido/` | Utilidad genérica de *debounce* sin dominio |
| `RUTA_PRODUCTO = '/catalogo/:productoId'`, `rutaProducto(id)` | `shared/config/routes.ts` | Fuente única de paths; no se agrega a `RUTAS` (no es sección de navegación ni entra en `MAPA_RUTAS`/`ACCESO_RUTAS`, que exigen dueño y acceso por sección) |
| Handlers MSW `productoDto`, `categoriaNodoDto`, `handlersCatalogo(estado)` | `src/test/msw/catalogo.ts` | Fuera de las capas, como `direcciones.ts` |

*Alternativas descartadas*: (a) botón de agregar dentro de `entities/producto`: importaría `@/entities/cart` (cross-import prohibido); (b) un widget «catálogo»: la skill desaconseja `widgets` y el panel tiene un solo consumidor; (c) `pages/catalogo` sirviendo también el detalle con ruta anidada: dos pantallas con estados distintos, se separan para mantener cada página chica.

### D2 — Consultas y claves

```ts
export const productoQueries = {
  todas: () => ['productos'] as const,
  listas: () => ['productos', 'lista'] as const,
  lista: (filtros: FiltrosProductos) =>
    queryOptions({
      queryKey: ['productos', 'lista', filtros] as const,
      queryFn: () => listarProductos(filtros),
      placeholderData: keepPreviousData,
    }),
  detalle: (id: number) =>
    queryOptions({ queryKey: ['productos', 'detalle', id] as const, queryFn: () => obtenerProducto(id) }),
};
export const categoriaQueries = {
  arbol: () => queryOptions({ queryKey: ['categorias', 'arbol'] as const, queryFn: obtenerArbolCategorias, staleTime: 5 * 60_000 }),
};
```

- `FiltrosProductos = { page, size, q?, categoriaIds?, precioMin?, precioMax?, conStock? }` normalizado (sin claves `undefined`, `categoriaIds` ordenados) para que dos URLs equivalentes compartan caché.
- `listarProductos` envía siempre `disponible: true` (spec «Solo productos visibles al público») y traduce a snake_case (`categoria_ids`, `precio_min`, `precio_max`, `con_stock`).
- **Serialización de listas**: Axios por defecto envía `categoria_ids[]=1`; FastAPI espera `categoria_ids=1&categoria_ids=4`. `listarProductos` pasa `paramsSerializer: { indexes: null }` en la llamada (no se cambia la instancia global para no alterar otros endpoints). Un test lo fija con la query string exacta.
- Claves públicas (`productos`, `categorias` ya están en `CLAVES_PUBLICAS`): `SesionGate` no las descarta al cerrar sesión, sin código nuevo.
- `staleTime` del listado/detalle: el de la app (30 s); el árbol cambia poco: 5 min.
- El detalle no usa los datos del listado como `placeholderData` (el listado y el detalle tienen la misma forma, pero la ganancia es mínima y complica la prueba de carga); se muestra el esqueleto del detalle.

### D3 — Filtros en la URL

- Fuente única: `useSearchParams`. `filtrosDesdeUrl(params, arbol?)` (pura) devuelve `FiltrosUrl = { categoria?: number, q?: string, min?: number, max?: number, stock: boolean, page: number }` validando: enteros positivos para `categoria`/`page` (si no, se omiten / 1), enteros ≥ 0 para `min`/`max` (si `min > max`, se ignoran ambos), `stock=1` → `true`, `q` recortado (vacío → sin `q`).
- `aParametrosApi(filtrosUrl, arbol)` (pura): `categoria` → `categoriaIds = idsDelSubarbol(arbol, categoria)`; mientras el árbol no llegó, `[categoria]` (la consulta se repite al llegar el árbol porque la clave cambia; ver R2); si el árbol llegó y el id no existe → sin filtro de categoría y se quita de la URL (`replace`).
- Cualquier cambio de filtro escribe la URL con `page` eliminado (página 1); los cambios de página y de búsqueda usan `replace: false` salvo la búsqueda diferida, que usa `replace: true` para no llenar el historial con cada pausa al tipear.
- `size` fijo `TAMANO_PAGINA = 12` (grillas de 2, 3 y 4 columnas sin huecos); no va en la URL.
- Al cambiar de página: `window.scrollTo({ top: 0 })` y foco al encabezado de resultados (`tabIndex={-1}`), para lectores de pantalla.

### D4 — Búsqueda con *debounce*

- Campo controlado con estado local; `useValorDiferido(texto, 300)` produce el valor que se escribe en la URL. Tests con `vi.useFakeTimers({ shouldAdvanceTime: true })` + `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- Si la URL cambia desde afuera («Limpiar filtros», «Atrás»), el campo se sincroniza con ella (efecto que copia `q` al estado local cuando difiere del último valor escrito).
- Botón «Borrar búsqueda» dentro del campo cuando hay texto (borra sin esperar el *debounce*).

### D5 — Precio y rango

- `formatearPrecio("1250.50")` → `"$ 1.250,50"`, `"12000.00"` → `"$ 12.000"`: se separa el string en entero/decimales (sin `parseFloat`), se agregan puntos de miles a mano y la coma solo si los centavos no son `00`. *Alternativa*: `Intl.NumberFormat('es-AR', { style: 'currency' })`: el resultado depende del ICU del entorno (espacio duro, `ARS`/`$`), difícil de fijar en tests de jsdom y Node.
- Rango: formulario chico (dos `Campo` numéricos + «Aplicar») con estado local; `validarRangoPrecio({min, max})` pura: no enteros o negativos → «Ingresá un número entero», `min > max` → «El mínimo no puede superar al máximo» (en el campo máximo). Se aplica al pulsar «Aplicar» (o Enter), no al tipear: evita pedidos por cada dígito. Sin TanStack Form: dos campos sin envío al servidor no justifican la librería.

### D6 — Paginación clásica

Botones «Anterior»/«Siguiente» con `Paginacion` compartida, `placeholderData: keepPreviousData` y el listado atenuado (`aria-busy`) mientras llega la página nueva. *Alternativa*: scroll infinito con `useInfiniteQuery`: la KB y la rúbrica piden `page/size`, la URL no puede representar «páginas 1..3 cargadas» y la navegación por teclado es peor.

### D7 — Árbol de categorías y layout responsivo

- Desktop (≥ 1024 px): columna de filtros de 264 px a la izquierda del listado (dentro de la página, a la derecha del panel lateral de la app) con, en orden: árbol «Categorías», «Precio», «Disponibilidad». El árbol muestra todos los niveles expandidos (el seed tiene 2 niveles; con más de 2 niveles se indentan igual): `nav[aria-label="Categorías"] > ul > li > button`; la actual con `aria-current="true"` y estilo de ítem actual del sidebar.
- Mobile (< 1024 px): sobre el listado, el buscador a lo ancho, una fila de chips desplazable horizontalmente con «Todas» + categorías raíz (botones con `aria-pressed`) y el botón «Filtros» (con contador de filtros aplicados) que abre una hoja inferior (`Dialogo` de C-15, que bajo 720 px ya se apoya abajo; se le suma la prop opcional `desplazable` —cuerpo con `max-height: 85dvh` y scroll, pie fijo— sin cambiar su comportamiento actual; título «Filtros») con el árbol completo, precio y disponibilidad; pie fijo con «Limpiar» y «Ver resultados». En la hoja las elecciones se aplican al momento (la consulta ya corre detrás y el pie muestra «Ver N productos» con el total actual).
- `useMediaQuery('(min-width: 1024px)')` decide qué se monta (no solo CSS): evita dos árboles en el DOM con el mismo nombre accesible.
- Chips de filtros activos sobre la grilla en ambos tamaños.

### D8 — Tarjeta, stock e imagen

- `estadoStock`: 0 → `agotado` (marca «Agotado» `b-cancelado`, imagen en escala de grises, botón deshabilitado «Agotado»); 1..5 → `pocas` («Quedan N», `b-pendiente`); > 5 → `normal`. `UMBRAL_POCAS_UNIDADES = 5` (OQ-4).
- `ImagenProducto`: `<img loading="lazy" alt={nombre}>` con `onError` → marcador (ícono `catalogo` sobre `--color-surface-alt`, `role="img"` con `aria-label` «Sin imagen de {nombre}»). Relación 4:3 fija para que no salte el layout.
- La tarjeta es un `<article>`; el nombre es el enlace al detalle (`<h3><a>`), con el área de la tarjeta clicable por CSS (`::after` sobre el enlace) sin anidar el botón dentro del enlace.
- Categoría mostrada: la `es_principal`, si no la primera.

### D9 — Detalle

- Ruta `RUTA_PRODUCTO` en `routes.tsx` como hija del shell (fuera de `MAPA_RUTAS`), envuelta en `RequiereAcceso acceso="publica"`. `productoId` se valida con `/^[1-9]\d*$/`; inválido → estado «no disponible» sin consulta (`enabled: false`).
- Layout: desktop dos columnas (imagen 1:1 a la izquierda, información a la derecha); mobile una columna con la barra «Agregar al carrito» fija abajo (sobre el contenido, respetando `safe-area-inset-bottom`).
- Selector de cantidad (`- n +`, 1..stock, botones «Restar una unidad»/«Sumar una unidad», el número en `output` con `aria-live="polite"`); sin input libre.
- Ingredientes: lista con marca «Alérgeno» (`b-pendiente` + ícono alerta) y, arriba, aviso «Contiene alérgenos: …» si hay alguno. `es_removible`, `cantidad` y unidad **no** se muestran (personalización: C-18).
- «Volver al catálogo»: la tarjeta navega con `state: { volverA: location.search }`; el detalle arma `/catalogo${volverA ?? ''}`. Sin `state` (enlace directo) vuelve a `/catalogo`.
- 404 → `EstadoNoDisponible`; otros errores → error con «Reintentar».

### D10 — Agregar al carrito

- `BotonAgregarAlCarrito({ producto, cantidad = 1, variante })`: `useCartStore((s) => s.agregar)` + `notificar({ tipo: 'success', titulo: 'Agregado al carrito', mensaje: '{cantidad} × {nombre}' })`. Deshabilitado si `stock_cantidad === 0`. Nombre accesible «Agregar {nombre} al carrito» (texto visible «Agregar» en la tarjeta, «Agregar al carrito» en el detalle).
- No valida contra lo que ya hay en el carrito (stock vs. cantidad acumulada): lo resuelve C-18/C-19 con la respuesta del backend (`INSUFFICIENT_STOCK`).
- El contador del carrito en el panel ya lee `selectTotalItems` (C-13b), así que se actualiza solo.

### D11 — Backend: movido a C-16a

El bloque de backend (parámetros `precio_min`/`precio_max`/`con_stock`, `AppError` 422 con `field` `precio_max`, `_aplicar_filtros` único y `EXISTS` en lugar de `JOIN`) se movió al change C-16a (`design.md` D1..D4 de C-16a). Este change no toca `backend/`. *Alternativa descartada* (registrada en C-16a): filtrar precio/stock en el cliente sobre la página actual, que rompe `total`/`pages` y la paginación.

### D12 — Tests

- MSW `src/test/msw/catalogo.ts`: estado en memoria (productos + árbol) con handlers para `GET /productos/`, `GET /productos/:id` y `GET /categorias/arbol` que aplican `q`, `categoria_ids`, `precio_min/max`, `con_stock`, `page/size` y registran las URLs recibidas (para afirmar la query string exacta y la cantidad de pedidos).
- Página: `renderApp('/catalogo')` anónimo y con sesión; viewport mobile con el helper `src/test/viewport.ts` existente.
- Unidad pura: `formatearPrecio`, `estadoStock`, `alergenos`, `idsDelSubarbol`, `filtrosDesdeUrl`, `aParametrosApi`, `validarRangoPrecio`.
- Accesibilidad: `esperarSinViolacionesA11y` en catálogo con datos, sin resultados, hoja abierta y detalle.
- Arquitectura: fixtures `features/x → @/entities/producto` y `@/entities/cart` (válido), `entities/producto → @/entities/cart` (inválido: cross-import).
- Backend: sin tests en este change (los de `catalog-search` son de C-16a); el MSW reproduce su contrato (nombres de parámetros, sin duplicados).

## Risks / Trade-offs

- **R1 [Imágenes externas del seed]** `via.placeholder.com` puede no responder. → Respaldo en `onError` (spec «Imagen del producto con respaldo»); el layout no cambia.
- **R2 [Doble pedido al abrir con `categoria` en la URL]** Si el árbol llega después del listado, la primera consulta usa `[categoria]` y la segunda el subárbol. → Aceptado (el árbol se cachea 5 min y suele llegar primero); *alternativa*: esperar el árbol para pedir productos (bloquea el listado si el árbol falla).
- **R3 [Stock desactualizado]** La tarjeta puede mostrar stock que otro cliente ya compró. → Aceptado: el backend verifica al crear el pedido (C-10); `staleTime` 30 s.
- **R4 [Carrito por encima del stock]** Se pueden agregar más unidades que el stock sumando varias veces. → C-18/C-19 (la creación del pedido responde `INSUFFICIENT_STOCK`).
- **R5 [Dependencia de C-16a]** Los filtros de precio y stock y la ausencia de duplicados dependen de C-16a. → El change se parte (2026-11-18) y C-16b no empieza su apply hasta que C-16a esté cerrado; los tests de frontend usan MSW con el contrato de C-16a, así que el verify visual con el backend real es el que confirma la integración.
- **R6 [`q` solo por nombre]** «sin TACC» no encuentra productos cuya descripción lo diga. → Fiel a la KB; el árbol cubre ese caso con la categoría «Sin TACC».

## Migration Plan

Sin migración de datos ni de esquema. Apply: requiere C-16a cerrado (backend con los filtros); luego los bloques de frontend de `tasks.md`. Rollback: revertir el commit.

## Open Questions

> Governance BAJO: se aplican los valores por defecto salvo que el usuario diga otra cosa. Las specs ya están escritas con los valores por defecto.
>
> OQ-1..OQ-3 del C-16 original (precio en el backend, «Solo con stock», categoría con subcategorías sin duplicados) **ya no son preguntas**: el usuario las resolvió el 2026-11-18 con su valor por defecto; ver D0 y `openspec/changes/c-16a-backend-catalogo-filtros/design.md` DU-1..DU-3.

- **OQ-4 — Umbral de «pocas unidades».** Por defecto: **5** («Quedan N» de 1 a 5). Alternativa: otro número o no mostrar el aviso.
- **OQ-5 — Agregar al carrito sin sesión.** Por defecto: **sí** (el carrito es estado de cliente persistente, CE-14; el login se pide al ir al carrito, que tiene acceso `sesion`). Alternativa: el botón lleva a «Ingresar» si no hay sesión.
- **OQ-6 — Tamaño de página.** Por defecto: **12** (grilla de 2/3/4 columnas sin huecos). Alternativa: 20 (defecto del backend).

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-18)
- Mockups: `mockups/` (`catalogo.html`, `catalogo-carga.html`, `catalogo-vacio.html`, `catalogo-filtros.html`, `producto-detalle.html`, `mockup.css`, `mockup.js`, `catalogo.js`, `README.md`, `previews/`)
- Approval: pending
- Preview: rendered (2026-11-18, headless Microsoft Edge desde `file://` con «reducir movimiento», 1440x900 y 390x844 —390 px dentro de un iframe—; capturas en `mockups/previews/`: `catalogo`, `catalogo-filtrado`, `carga`, `vacio`, `sin-productos`, `error`, `filtros`, `detalle`, `detalle-agotado`, `no-disponible`, cada una `-desktop.png` y `-mobile.png`, más `catalogo-completo-desktop.png` (1440x2080, página entera); inspeccionadas y corregidas: ancho del esqueleto, título de sección en la hoja, marca «Agotado» sin escala de grises)
- Origen: creados en el change `c-16-fe-catalogo-publico` (antes del split del 2026-11-18) y movidos intactos a este change, capturas incluidas; los títulos y franjas de anotación de los HTML (y por lo tanto las capturas) dicen «Mockup C-16»: se refieren a este change (C-16b). La aprobación sigue pendiente y es la de esta misma revisión.

Estados visibles y cobertura:

| Estado | Mockup |
|--------|--------|
| Catálogo con datos: árbol (desktop) / chips (mobile), búsqueda, precio, «Solo con stock», chips de filtros activos, tarjetas normal / «Quedan 2» / «Agotado» / sin imagen, paginación, toast «Agregado al carrito» | `catalogo.html` |
| Catálogo filtrado por subcategoría («Veganas») con el árbol marcando la actual | `catalogo.html?estado=filtrado` |
| Esqueleto de carga | `catalogo-carga.html` |
| Sin resultados con filtros | `catalogo-vacio.html` |
| Catálogo sin productos (sin filtros) | `catalogo-vacio.html?estado=sin-productos` |
| Error del listado con reintento (árbol visible) | `catalogo-vacio.html?estado=error` |
| Filtros con subcategoría elegida y error de rango: columna (desktop) / hoja «Filtros» abierta (mobile) | `catalogo-filtros.html` |
| Detalle con ingredientes y alérgenos, «Quedan 3», selector de cantidad | `producto-detalle.html` |
| Detalle agotado | `producto-detalle.html?estado=agotado` |
| Producto no disponible (404) | `producto-detalle.html?estado=no-disponible` |
