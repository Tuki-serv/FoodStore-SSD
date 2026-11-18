# Proposal — C-16b `fe-catalogo-publico`

> C-16 se partió en dos changes (2026-11-18), como C-13a/C-13b: **C-16a** `backend-catalogo-filtros` (backend: `precio_min`/`precio_max`/`con_stock` y resultados sin duplicados en `GET /productos/`) y **C-16b** (este, frontend: catálogo, árbol de categorías y detalle). C-16b depende de C-13b y de C-16a.

## Why

US-007 (Épica 3) pide que clientes y visitantes exploren el catálogo con filtros (categoría, nombre, rango de precio, disponibilidad), paginación y un detalle con categorías, ingredientes (alérgenos) y stock; US-008 pide navegar por el árbol de categorías. Hoy `/catalogo` —la ruta raíz de la app y la única pública con contenido— muestra la página provisoria (dueño `C-16b` en `route-map.ts`). C-16b está en el camino crítico: C-18 (carrito y personalización) parte de la tarjeta y el detalle de producto que deja este change.

Observado en el repo (`dev`, 2026-11-18):

- `GET /api/v1/productos/` (público, `lector_privilegiado`) acepta `page`/`size` (1..100, defecto 20), `q` (busca **solo en `nombre`**, `ILIKE`), `categoria_ids` (lista), `ingrediente_ids`, `disponible` y `estado`; ordena por `id` ascendente. Devuelve `Paginado<ProductoReadFull>`: `precio_base` como **string decimal** (`"1500.00"`, `Numeric(10,2)`), `stock_cantidad`, `disponible`, `imagenes_url` (nullable), `categorias[{id,nombre,es_principal}]`, `ingredientes[{id,nombre,es_alergeno,es_removible,cantidad,unidad_medida_id}]`.
- El filtro de precio (`precio_min`/`precio_max`), el de «con stock» (`con_stock`) y la corrección de duplicados al filtrar por varias categorías **no existen hoy**: los agrega **C-16a** (decisiones del usuario 2026-11-18, ex OQ-1..OQ-3, registradas en `openspec/changes/c-16a-backend-catalogo-filtros/design.md` DU-1..DU-3). Este change los consume.
- Para el público el backend fuerza `disponible = true` (spec `catalog-visibility`); un ADMIN/STOCK con sesión ve también los no disponibles si no envía `disponible`. `GET /productos/{id}` de un no disponible es 404 para el público.
- `GET /api/v1/categorias/arbol` (público) devuelve `{data: CategoriaTreeNode[], total}` con `subcategorias` anidadas, ordenado por nombre y solo activas; no trae conteo de productos.
- `stock_cantidad = 0` con `disponible = true` es posible (RN-PR-02: el toggle es independiente; PA-12 abierta): el frontend debe mostrarlo como «Agotado» y no dejar agregarlo.
- Frontend: `CLAVES_PUBLICAS` ya incluye `productos` y `categorias`; `Paginado<T>`, `apiClient`, `useCartStore.agregar` (precio como string decimal) y los helpers de test (`renderApp`, MSW, axe) existen desde C-13b/C-15. `RUTAS` no tiene ruta de detalle.

## What Changes

- **Entidades** `producto` y `categoria` (`frontend/src/entities/`): tipos del contrato, llamadas con `apiClient`, consultas públicas (`queryOptions`, claves `['productos', …]` y `['categorias', 'arbol']`), helpers puros (formato de precio, estado de stock, alérgenos, ids de un subárbol) y la tarjeta de producto reutilizable por C-18.
- **Página «Catálogo»** (`/catalogo`, pública): grilla de tarjetas, árbol de categorías (columna lateral en desktop, hoja inferior en mobile), búsqueda por nombre con *debounce*, rango de precio, «Solo con stock», chips de filtros activos, paginación `page/size`; esqueleto de carga, estado vacío (sin productos / sin resultados con filtros) y error con reintento. Los filtros viven en la URL (`?categoria=&q=&min=&max=&stock=&page=`). Elegir una categoría envía esa categoría **y todas sus subcategorías** (decisión DU-3 de C-16a).
- **Página «Detalle de producto»** (`/catalogo/:productoId`, pública): imagen, categorías, precio, descripción, stock («Quedan N», «Agotado»), ingredientes con alérgenos destacados, selector de cantidad y «Agregar al carrito» (sin personalización: es C-18); 404 → «Producto no disponible».
- **Agregar al carrito** desde la tarjeta y el detalle con `useCartStore.agregar` y notificación de éxito, **solo con sesión**: un visitante anónimo que pulsa «Agregar» va a `/ingresar` y, tras iniciar sesión, vuelve al mismo lugar (misma URL con filtros y página, o el mismo detalle) sin tener que buscar el producto de nuevo (decisión del usuario 2026-11-18, OQ-5). Reutiliza el mecanismo `state.desde` de C-13b y lo extiende para que reconozca `/catalogo/:productoId`. Explorar el catálogo y el detalle sigue siendo público; el producto no se agrega automáticamente tras el login.
- **Docs al cerrar**: KB/06 (US-007, US-008), KB/08 (árbol FSD), `frontend/README.md`, `CHANGES.md` (cierre de C-16b y «Punto de partida (C-16b)» para C-18).

**Fuera de alcance (con dueño):** los filtros y la corrección de duplicados en el backend (C-16a); personalización (excluir ingredientes removibles) y página del carrito (C-18); ordenamiento del listado (no especificado; el backend ordena por `id`); filtro por ingrediente en la UI (no lo pide US-007); galería de varias imágenes (se muestra la primera); administración de productos/categorías (C-17a/C-17b); auto-marcar no disponible con stock 0 (PA-12).

## Capabilities

### New Capabilities
- `frontend-catalog`: catálogo público en el frontend — listado filtrable y paginado, árbol de categorías, detalle de producto con ingredientes/alérgenos/stock y agregado al carrito.

### Modified Capabilities
_(ninguna: `frontend-app-shell` no cambia —la ruta de detalle cuelga de `/catalogo` y no es una sección de navegación—; `frontend-client-stores` ya define `agregar`. La capacidad backend `catalog-search` la crea C-16a.)_

## Impact

- **Código nuevo** (`frontend/src/`): `entities/producto/` y `entities/categoria/` (`model/`, `api/`, `ui/`, `index.ts`), `features/agregar-al-carrito/`, `pages/catalogo/` y `pages/producto/` (`ui/`, `model/`, `index.ts`), `shared/ui/paginacion/`, `shared/lib/valor-diferido` (hook `useValorDiferido`), handlers MSW `src/test/msw/catalogo.ts`.
- **Código modificado**: `shared/config/routes.ts` (`rutaProducto(id)`), `app/router/routes.tsx` (`/catalogo` monta la página real y se agrega `/catalogo/:productoId`), `shared/ui/icon` (íconos nuevos), `shared/ui/dialogo` (prop `desplazable`), `pages/direcciones` (usa la `Paginacion` compartida).
- **Backend**: ninguno (todo lo de backend está en C-16a).
- **Dependencias de paquetes**: ninguna nueva. **Dependencias de changes**: C-13b (cerrado) y C-16a.
- **Docs**: `knowledge-base/06`, `knowledge-base/08`, `frontend/README.md`, `CHANGES.md`.
- **Governance BAJO**: autonomía total si los tests pasan; el único gate es la aprobación de los mockups (`[UI-MOCKUP]`, política `system-and-mockups`).
