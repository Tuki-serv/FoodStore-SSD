# Design — C-17a `fe-admin-categorias-ingredientes`

## Context

Motivación y contrato observado del backend: ver `proposal.md` (Why). Requisitos: spec `frontend-admin-catalog`. Lo que este diseño necesita del estado actual:

- **Shell y acceso** (C-13a/C-13b): `RUTAS.adminCategorias`/`adminIngredientes` ya tienen `roles: ['ADMIN']` en `ACCESO_POR_RUTA`; `RequiereAcceso` muestra la página 403; el panel filtra la sección «Administración» por rol. `routes.tsx` monta `PlaceholderPage` para cualquier ruta sin entrada en su mapa de páginas.
- **Catálogo** (C-16b): `entities/categoria` expone `CategoriaNodo` (con `parent_id`, `descripcion`, `imagen_url`), `buscarCategoria`, `idsDelSubarbol`, `raices`, `categoriaQueries.arbol()` (clave pública `['categorias','arbol']`, `staleTime` 5 min) y `ArbolCategorias` (navegación del catálogo, no editable).
- **CRUD de referencia** (C-15): `pages/direcciones` (formulario en la misma página que reemplaza la lista, validación pura en `model/validacion.ts`, diálogo de baja con `shared/ui/dialogo`, toasts de `shared/model`), `entities/direccion/api/direccion-mutations.ts` (mutación + `invalidateQueries`).
- **Errores**: `ApiError` con `status`, `code`, `field`; `mensajeDeCampo` devuelve el `detail` del servidor para un `field`; acá el 409 `DUPLICATE_VALUE` de `nombre` se traduce a un texto propio por `code` + `field` («Ya existe una categoría con ese nombre.»), sin depender del texto del backend.
- `CLAVES_PUBLICAS` incluye `categorias`, `ingredientes` y `unidades-medida`: esos datos sobreviven al cierre de sesión.

## Goals / Non-Goals

**Goals:**
- Dos páginas ADMIN funcionales contra la API actual, sin cambios de backend.
- Reutilizar al máximo las piezas de C-15/C-16b (diálogo, campo, paginación, toasts, árbol, patrón de mutaciones).
- Prevenir ciclos en la UI (no ofrecer padres inválidos) dejando al servidor como autoridad.

**Non-Goals:**
- Productos, stock, `es_removible` (C-17b); imágenes y unidades de medida (C-28).
- Ver o restaurar eliminados (`estado=ELIMINADO|TODOS` existe en la API pero ninguna historia lo pide).
- Búsqueda por nombre de ingredientes (la API no tiene `q` para ingredientes).

## Decisions

### D1 — Ubicación FSD
- `entities/categoria`: se amplía `api/` con `crearCategoria`, `editarCategoria`, `eliminarCategoria` y los hooks `useCrearCategoria`/`useEditarCategoria`/`useEliminarCategoria` (como `direccion-mutations.ts`); `model/` suma `padresPosibles(arbol, idEditado?)` (lista plana con profundidad, excluye el subárbol del editado) y `contarDescendientes`.
- `entities/ingrediente` (nuevo): tipos del contrato (`Ingrediente` con `productos[{id,nombre}]`), `ingredienteQueries.lista({page,size,alergeno})`, mutaciones; `model/` con `resumenUso(productos)` («Lo usan 2 productos: A, B», hasta 3 nombres + «y N más»).
- `entities/unidad-medida` (nuevo, mínimo): tipo, `unidadMedidaQueries.todas()` (`size=100`, `staleTime` 30 min) y `etiquetaUnidad` («Gramo (g)»). Se ubica como entidad porque C-17b la reutiliza en producto↔ingrediente.
- `pages/admin-categorias` y `pages/admin-ingredientes` (`ui/`, `model/validacion.ts`, `index.ts`). No se crea `features/`: cada acción se usa en una sola página (regla FSD: no extraer antes de reutilizar).
- *Alternativa descartada*: un slice `features/gestionar-categoria`; sin segundo consumidor solo agrega indirección.

### D2 — Consultas, claves e invalidación
- El árbol de administración usa la **misma** consulta pública `categoriaQueries.arbol()`: una sola fuente, y al invalidar `['categorias']` tras cualquier mutación el catálogo de C-16b se actualiza sin recargar (spec «Alta y edición de categoría»). En la página admin se usa `staleTime: 0` (`refetchOnMount: 'always'`) para no mostrar un árbol viejo de hasta 5 minutos.
- Ingredientes: `['ingredientes','lista',{page,size:20,alergeno}]` con `placeholderData: keepPreviousData`; mutaciones invalidan `['ingredientes']` **y** `['productos']` (el detalle público muestra la marca de alérgeno de cada ingrediente).
- Mutaciones de categoría invalidan `['categorias']` y `['productos']` (las tarjetas muestran la categoría principal por nombre).
- *Alternativa descartada*: claves `['admin', …]` privadas; duplicarían el árbol y obligarían a invalidar dos cachés.

### D3 — Formulario en la página (patrón C-15)
- El formulario reemplaza a la lista dentro de la misma ruta (estado local `{tipo:'alta'|'edicion', …}`), con «Volver a Categorías/Ingredientes» y foco en el título al abrir. Sin rutas `/nueva` ni `/:id/editar`: no se piden enlaces directos y así se mantiene igual que C-15.
- Validación pura (`validarCategoria`, `validarIngrediente`) con `trim`, obligatorio y máximo 100; se valida al enviar y luego por campo al cambiar (como C-15). TanStack Form, igual que el formulario de direcciones.
- Edición envía `PATCH` **solo con los campos cambiados** (diff contra los valores iniciales); si no cambió nada, vuelve sin pedir.
- «Agregar subcategoría» abre el alta con el padre ya elegido.

### D4 — Padre sin ciclos y profundidad
- El selector de padre es un `<select>` nativo con las categorías aplanadas en orden de árbol e indentadas con «— » por nivel; primera opción «Sin padre (categoría raíz)». En edición, `padresPosibles` excluye `idsDelSubarbol(arbol, id)`.
- El servidor sigue siendo la autoridad: 400 (ciclo/propio padre) y 404 (padre borrado mientras se editaba) se muestran como alerta general.
- *Alternativa descartada*: un árbol con radios; más pesado en mobile y sin ganancia con 6–20 categorías.

### D5 — `imagen_url` obligatoria en el alta
- `CategoriaCreate.imagen_url` es `str` obligatorio en la API (la columna admite `NULL`). El formulario ofrece «URL de imagen (opcional)»; vacía en el alta se envía `imagen_url: ""` y en la edición se omite si no cambió. La subida real es C-28 (US-013). Ver OQ-1.

### D6 — Bajas
- **Categoría**: si el nodo tiene subcategorías en el árbol cargado, el diálogo explica «Tiene N subcategorías activas. Movelas a otra categoría o eliminalas primero.» con un solo botón «Entendido» (sin pedido). Si no, confirma con «Eliminar» (`btn-danger`); 409 `CATEGORY_HAS_PRODUCTS` → «No se puede eliminar: tiene productos activos. Quitalos de la categoría desde Productos y stock.»; 409 `CATEGORY_HAS_CHILDREN` (árbol desactualizado) → mensaje equivalente e invalidación del árbol. Se decide por `code`, nunca por `detail`.
- **Ingrediente**: la API no valida uso; el diálogo avisa con `resumenUso(productos)` y deja confirmar (soft delete; las asociaciones existentes no se tocan). Ver OQ-2.
- Mientras la baja está en curso el botón queda deshabilitado con «Eliminando…»; Escape/«Cancelar» cierran salvo durante el pedido.

### D7 — Listado de ingredientes
- Lista de filas (no `<table>`) para que en 390 px cada fila apile nombre/marca, descripción y metadatos sin scroll horizontal; en desktop las columnas se alinean con una grilla CSS. Encabezado con «20 ingredientes» y un `segmented control` (tres botones con `aria-pressed`) para el filtro.
- Filtro y página en la URL (`?alergeno=si|no&page=2`), como los filtros de C-16b; cambiar el filtro vuelve a la página 1. Paginación con `shared/ui/paginacion`.

### D8 — Íconos y estilos
- Íconos nuevos en `shared/ui/icon` solo los que el mockup aprobado use (`i-subcategoria` para «Agregar subcategoría», `i-alergeno` para la marca); el resto (`i-editar`, `i-basura`, `i-mas`, `i-alerta`) existe desde C-15.
- CSS por página (`admin-categorias.css`, `admin-ingredientes.css`) importado en `app/styles/index.css` **antes de cualquier regla** (lección V-1 de C-16b, cubierta por `tests/architecture/styles-compile.test.ts`).

### D9 — Tests
- MSW `src/test/msw/admin-catalogo.ts`: árbol del seed, ingredientes del seed (12, con `productos`), unidades del seed, handlers de POST/PATCH/DELETE con estado en memoria, registro de cuerpos enviados y variantes de error (409 `DUPLICATE_VALUE`, 409 `CATEGORY_HAS_PRODUCTS`/`CATEGORY_HAS_CHILDREN`, 400, red caída).
- Por página: render con sesión ADMIN (`src/test/sesion.ts`), axe sin violaciones, permisos (CLIENT/STOCK → 403 sin pedidos de escritura).

## Risks / Trade-offs

- [El árbol público excluye eliminadas pero un hijo de una padre eliminada podría quedar huérfano] → la API impide eliminar una categoría con hijas activas (RN-CA-03), así que no ocurre por la UI.
- [`imagen_url: ""` guarda una cadena vacía] → ninguna pantalla actual muestra imágenes de categoría; C-28 reemplaza el campo por la subida. OQ-1.
- [Baja de ingrediente en uso sin validación del servidor] → aviso explícito en el diálogo con los productos afectados; OQ-2.
- [Árbol con `staleTime` 5 min en el catálogo] → la invalidación tras mutar lo refresca en la misma pestaña; otras pestañas/usuarios ven el cambio al vencer.
- [Listado admin de categorías limitado a activas] → coherente con la API pública del árbol; no se gestionan eliminadas.

## Migration Plan

Solo frontend: no hay migraciones ni flags. Rollback = revertir el commit; las rutas vuelven a `PlaceholderPage`.

## Open Questions

- **OQ-1** (no bloquea): ¿preferís que C-17a incluya el ajuste mínimo de backend `CategoriaCreate.imagen_url: Optional[str] = None` (sin migración) en vez de enviar `""`? Por defecto: no se toca backend (D5).
- **OQ-2** (no bloquea): ¿la baja de un ingrediente usado por productos debería bloquearse (nuevo 409 en backend, otro change) o basta el aviso? Por defecto: aviso y confirmación (D6).

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-18)
- Mockups: `mockups/` (`categorias.html`, `categoria-form.html`, `categoria-eliminar.html`, `ingredientes.html`, `ingrediente-form.html`, `ingrediente-eliminar.html`, `mockup.css`, `mockup.js`, `admin.js`, `README.md`, `previews/`)
- Approval: approved (2026-11-18, by user) — OQ-1 y OQ-2: por defecto (D5, D6)
- Preview: rendered (2026-11-18, headless Microsoft Edge desde `file://` con «reducir movimiento», 1440x900 y 390x844 —390 px en un iframe, ventana de 1100 px recortada a 844—; Playwright MCP no disponible: falta el canal Chrome en esta máquina). Capturas en `mockups/previews/`: `categorias`, `categorias-creada`, `categorias-carga`, `categorias-vacio`, `categorias-error`, `categoria-form`, `categoria-form-editar`, `categoria-form-duplicado`, `categoria-form-red`, `categoria-eliminar`, `categoria-eliminar-subcategorias`, `categoria-eliminar-productos`, `ingredientes`, `ingredientes-carga`, `ingredientes-vacio`, `ingredientes-error`, `ingrediente-form`, `ingrediente-form-editar`, `ingrediente-form-duplicado`, `ingrediente-eliminar`, `ingrediente-eliminar-sin-uso` (cada una `-desktop.png` y `-mobile.png`) y `drawer-admin-mobile.png`. Inspeccionadas y corregidas: filas de ingredientes apiladas en mobile (acciones abajo), columnas del encabezado alineadas en desktop, nombre/padre a la par en el formulario de categoría.
- Visual verify: passed (2026-11-18): 21 pantallas/estados + drawer comparados contra los mockups aprobados en 1440x900 y 390x844 (Edge headless + Playwright, API simulada con `page.route`, ADMIN). Capturas en `mockups/verify/`, comparativas lado a lado en `mockups/verify/comparativas/`. Corregidos durante la verificación: botones compactos (`claseBoton` mezclaba `px-5`/`min-h-tap` con las de `compacto`; las acciones de las filas anidadas se cortaban en mobile), tarjeta «Es alérgeno» sin el resaltado `is-on`. Diferencias menores documentadas (sin corregir): toast con borde oscuro en vez de verde y texto más corto («Aguas» sin «dentro de Bebidas»; «Maní» sin «marcado como alérgeno»); detalle del estado de error más corto («No pudimos conectar con el servidor.»); en carga no se muestra «Nueva categoría» en categorías; la tarjeta del formulario ocupa más ancho que en el mockup. Sin errores de consola ni pedidos fallidos salvo los provocados a propósito (409 y red caída).

Estados visibles y cobertura:

| Estado | Mockup |
|--------|--------|
| Árbol con subcategorías anidadas y acciones por fila | `categorias.html` |
| Categoría recién creada (resaltada + toast) | `categorias.html?estado=creada` |
| Carga / vacío / error con reintento | `categorias.html?estado=carga\|vacio\|error` |
| Alta de subcategoría con padre preelegido y error de nombre vacío | `categoria-form.html` |
| Edición con padres filtrados (sin ciclos) | `categoria-form.html?modo=editar` |
| Nombre repetido (409) / sin conexión (alerta general) | `categoria-form.html?modo=duplicado\|red` |
| Confirmar baja / con subcategorías / rechazada por productos (409) | `categoria-eliminar.html`, `?estado=subcategorias\|productos` |
| Listado de ingredientes con alérgenos, unidad, uso, filtro y toast | `ingredientes.html` |
| Carga / filtro sin resultados / error | `ingredientes.html?estado=carga\|vacio\|error` |
| Alta, edición y nombre repetido de ingrediente | `ingrediente-form.html`, `?modo=editar\|duplicado` |
| Baja de ingrediente en uso / sin uso | `ingrediente-eliminar.html`, `?estado=sin-uso` |
| Panel lateral admin en mobile | `categorias.html?nav=drawer` |
