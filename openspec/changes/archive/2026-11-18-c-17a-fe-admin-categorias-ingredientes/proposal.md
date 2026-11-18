# Proposal — C-17a `fe-admin-categorias-ingredientes`

## Why

US-009 (gestión de categorías: nombre único, anti-ciclos, baja validada) y US-011 (ingredientes con `es_alergeno` y unidad de medida) solo existen hoy en la API: `/admin/categorias` y `/admin/ingredientes` muestran la página provisoria (dueño `C-17a` en `route-map.ts`). Sin estas pantallas el ADMIN no puede armar el catálogo que consume el público (C-16b) ni preparar las categorías e ingredientes que C-17b asocia a cada producto.

Observado en el repo (`dev`, 2026-11-18):

- **Categorías** (`/api/v1/categorias`): `GET /arbol` (público, solo activas, anidado, ordenado por nombre); `POST /` (ADMIN, 201 `CategoriaRead`) con `nombre` (≤100), `descripcion?`, `parent_id?` e **`imagen_url` obligatorio** (string); `PATCH /{id}` (ADMIN, parcial); `DELETE /{id}` (ADMIN, 204, soft delete). Errores: 409 `DUPLICATE_VALUE` `field=nombre`; 400 si la categoría queda como su propio padre o se forma un ciclo; 404 si el padre no existe; 409 `CATEGORY_HAS_PRODUCTS` (prioritario) y 409 `CATEGORY_HAS_CHILDREN` al eliminar.
- **Ingredientes** (`/api/v1/ingredientes`): `GET /` paginado (`page`, `size` ≤100, `is_alergeno?`), cada uno con `productos[{id,nombre}]`; `POST /` (ADMIN) con `nombre`, `es_alergeno`, `descripcion?`, `unidad_medida_id` (defecto 1); `PATCH /{id}`; `DELETE /{id}` (204, soft delete **sin** validar productos asociados). 409 `DUPLICATE_VALUE` `field=nombre`.
- **Unidades de medida** (`GET /api/v1/unidades-medida/`, pública, paginada): el seed trae 7 (kg, g, L, mL, u, doc, m²).
- **Frontend**: guardas por ruta ya restringen ambas rutas a `ADMIN` (C-13b) y el panel ya muestra «Categorías» e «Ingredientes» solo a ADMIN; `entities/categoria` (C-16b) ya tiene el árbol (`categoriaQueries.arbol()`, `ArbolCategorias`, `idsDelSubarbol`); `entities/direccion` (C-15) es el patrón de mutaciones con invalidación; `ApiError` expone `code` y `field`.
- `es_removible` **no** es un atributo del ingrediente sino de la asociación producto↔ingrediente (`ProductoIngrediente`): se edita al gestionar productos (C-17b).

## What Changes

- **Página «Categorías»** (`/admin/categorias`, solo ADMIN): árbol completo de categorías activas con subcategorías anidadas, cantidad de subcategorías, acciones «Editar», «Eliminar» y «Agregar subcategoría» por fila; «Nueva categoría»; esqueleto de carga, estado vacío y error con reintento.
- **Formulario de categoría** (alta y edición, en la misma página como en C-15): nombre (obligatorio, ≤100), descripción, categoría padre (opcional; en edición se excluyen la propia categoría y todo su subárbol para no ofrecer ciclos) y URL de imagen opcional (la subida a Cloudinary es C-28). Errores por campo; 409 `DUPLICATE_VALUE` se muestra en «Nombre»; 400 de ciclo y fallos de red como alerta general conservando lo escrito.
- **Eliminar categoría**: diálogo de confirmación; si el árbol muestra subcategorías activas se explica que hay que moverlas o eliminarlas antes (sin botón «Eliminar»); 409 `CATEGORY_HAS_PRODUCTS`/`CATEGORY_HAS_CHILDREN` se muestran dentro del diálogo.
- **Página «Ingredientes»** (`/admin/ingredientes`, solo ADMIN): listado paginado (20 por página) con nombre, descripción, unidad, marca «Alérgeno» y «Usado en N productos»; filtro Todos / Alérgenos / No alérgenos; alta, edición y baja con diálogo que avisa en qué productos se usa.
- **Formulario de ingrediente**: nombre, descripción, unidad de medida (lista del servidor) y «Es alérgeno».
- Al crear, editar o eliminar se invalidan las consultas de categorías o ingredientes, de modo que el catálogo público (C-16b) ve el cambio sin recargar; aviso de éxito con los toasts existentes.
- **Docs al cerrar**: KB/06 (US-009, US-011), KB/08 (árbol FSD), `frontend/README.md`, `CHANGES.md` (cierre de C-17a y «Punto de partida (C-17a)» para C-17b).

**Fuera de alcance (con dueño):** productos, stock, disponibilidad y la asociación producto↔ingrediente con `es_removible` (C-17b); subida de imágenes y CRUD de unidades de medida (C-28: US-013, US-014); ver o restaurar elementos eliminados (no especificado); reordenar el árbol por arrastre; cambios de backend.

## Capabilities

### New Capabilities
- `frontend-admin-catalog`: administración del catálogo en el frontend para ADMIN — categorías (árbol, alta, edición sin ciclos, baja validada) e ingredientes (listado paginado y filtrado, alta, edición, baja). C-17b la extenderá con productos y stock.

### Modified Capabilities
_(ninguna: el acceso por rol a `/admin/categorias` y `/admin/ingredientes` ya lo definen `frontend-route-guards` y `frontend-app-shell`; las reglas del servidor viven en `catalog-integrity`, que no cambia.)_

## Impact

- **Código nuevo** (`frontend/src/`): `entities/ingrediente/` y `entities/unidad-medida/` (`model/`, `api/`, `index.ts`), mutaciones en `entities/categoria/api/`, `pages/admin-categorias/` y `pages/admin-ingredientes/` (`ui/`, `model/`, `index.ts`), handlers MSW `src/test/msw/admin-catalogo.ts`.
- **Código modificado**: `app/router/routes.tsx` (las dos rutas montan las páginas reales), `entities/categoria` (modelo con `parent_id`/`descripcion`, helper de padres válidos), `shared/ui/icon` (íconos nuevos si se aprueban).
- **Backend**: ninguno. **Paquetes**: ninguno nuevo. **Dependencias**: C-13b y C-08 (cerrados), reutiliza piezas de C-15 y C-16b.
- **Governance MEDIO**: implementar con checkpoints; gate previo: mockups aprobados (`[UI-MOCKUP]`, política `system-and-mockups`).
