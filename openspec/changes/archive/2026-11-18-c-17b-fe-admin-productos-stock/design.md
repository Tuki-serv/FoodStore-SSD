# Design — C-17b `fe-admin-productos-stock`

## Context

Motivación y contrato observado: ver `proposal.md` (Why). Requisitos: specs `frontend-admin-catalog` (delta), `product-ingredients` (delta) e `ingredient-measure-unit` (nueva). Lo que este diseño necesita del estado actual:

- **Shell y acceso** (C-13b): `RUTAS.adminProductos` con `roles: ['ADMIN','STOCK']`; `RequiereAcceso` muestra 403; el panel ya muestra «Productos y stock» a ambos roles. `routes.tsx` monta `PlaceholderPage` mientras la ruta no tenga página.
- **Sesión**: los roles del usuario se leen de la sesión (`entities/session`); el backend es la autoridad (403 si un `STOCK` intenta escribir fuera de stock/disponibilidad).
- **Caché**: `CLAVES_PUBLICAS = ['productos','categorias','ingredientes','unidades-medida']` sobreviven al cierre de sesión; cualquier otra clave se descarta (`esConsultaPrivada`).
- **Catálogo** (C-16b): `entities/producto` con `Producto`, `formatearPrecio`, `estadoStock` (umbral 5), `categoriaPrincipal`, `MarcaStock`; `listarProductos` fija `disponible=true`.
- **C-17a**: patrón de página admin (formulario en la misma página, validación pura en `model/`, `dialogo-baja`, `estados`, `lista-admin`, toasts), `entities/categoria` (`categoriaQueries.arbol()`, `padresPosibles` para aplanar con nivel), `entities/ingrediente` (`ingredienteQueries.lista`), `entities/unidad-medida` (`todas()`, `etiquetaUnidad`).
- **Backend**: capas `models ← repository ← unit of work ← services ← routers`; `ProductoUnitOfWork` ya agrega los repos de categorías, ingredientes, links y unidades. `BaseRepository.delete` de un link sin `deleted_at` hace `flush`, así que reemplazar asociaciones con la misma PK en una transacción funciona.

## Goals / Non-Goals

**Goals:**
- Una página para dos roles con la misma lista; las acciones dependen del rol, no de rutas distintas.
- Guardar un producto completo (datos + categorías + ingredientes) en un pedido atómico.
- Cerrar los dos huecos de backend con cambios mínimos, sin migraciones y reutilizando la lógica ya probada de `asociar_ingrediente`.

**Non-Goals:**
- Unidad de venta e imágenes (C-28); productos eliminados; edición masiva; movimientos de stock.
- Arreglar `ProductoReadFull.unidad_venta_id` (siempre `null`): ninguna pantalla de este change lo usa (C-28).

## Decisions

### D1 — Ubicación FSD
- `entities/producto/api/`: se agrega `producto-gestion-api.ts` (`listarProductosGestion(filtros)` sin forzar `disponible`, `obtenerProductoGestion(id)`, `crearProducto`, `editarProducto`, `eliminarProducto`, `fijarStock`, `fijarDisponibilidad`), `productoGestionQueries` y `producto-mutations.ts` con los hooks. `model/` suma los tipos `ProductoDatos`/`ProductoCambios`/`IngredienteDeProductoDatos`.
- `pages/admin-productos/` (`ui/`: página, lista, fila con stock e interruptor, filtros, formulario, sección de categorías, sección de ingredientes, diálogo de baja; `model/`: validación, diff, filtros de URL, permisos por rol; `index.ts`).
- Sin `features/`: cada acción tiene un solo consumidor (misma regla que C-17a). Si C-22 o C-24 necesitan cambiar stock, se extrae entonces.
- *Descartado*: `entities/producto-admin` separado (duplicaría tipos y mappers del mismo dominio).

### D2 — Claves de caché: dominio privado `productos-gestion`
- Lista: `['productos-gestion','lista', filtrosNormalizados]` con `keepPreviousData`, `staleTime: 0`; detalle para editar: `['productos-gestion','detalle', id]`.
- Es privada a propósito: incluye no disponibles que solo ven ADMIN/STOCK; al cerrar sesión se descarta y un CLIENT posterior en el mismo navegador no la reutiliza. (`['productos', …]` es pública y sobreviviría.)
- Toda mutación invalida `['productos-gestion']` y `['productos']` (catálogo público y detalle). Stock y disponibilidad además escriben la respuesta del servidor en la fila con `setQueriesData` sobre las listas de gestión, para no recargar la página entera ni perder el foco en la fila.
- *Descartado*: reutilizar `productoQueries.lista` con un flag; mezclaría datos privados en un dominio público.

### D3 — Permisos en la UI
- `model/permisos.ts`: `accionesProductos(roles)` → `{ gestionar: roles incluye ADMIN, inventario: ADMIN o STOCK }`. La página oculta «Nuevo producto», «Editar» y «Eliminar» sin `gestionar`. Es solo presentación: el servidor sigue respondiendo 403.
- Si un `STOCK` llega a un formulario por estado obsoleto, no se renderiza (guardia en la página).

### D4 — Listado y filtros
- Lista de filas (como ingredientes de C-17a, `lista-admin`), no `<table>`: en 390 px cada fila apila nombre/categoría/precio arriba y stock + interruptor abajo; en desktop columnas alineadas con encabezado.
- Filtros en la URL: `?q=&categoria=<id>&disponible=si|no&page=`; cambiar un filtro vuelve a la página 1; la búsqueda se aplica al enviar (Enter o botón), no por tecla (evita un pedido por carácter). Categoría: `<select>` con `padresPosibles(arbol)` (lista indentada) → `categoria_ids=<id>`.
- Precio con `formatearPrecio`; stock con `MarcaStock` de C-16b («Agotado», «Quedan N»).

### D5 — Stock e interruptor por fila
- Stock: `<input type="number" inputmode="numeric" min="0" step="1">` con etiqueta «Stock de <producto>» y botón «Guardar stock de <producto>» que solo se habilita si el valor cambió; Enter guarda. Validación pura `validarStock(texto)` (entero ≥ 0, sin decimales) antes de enviar. Error en la fila (`aria-describedby`), valor conservado.
- Disponibilidad: `<button role="switch" aria-checked>` «Disponible» nombrado con el producto; **no optimista**: queda deshabilitado con «Guardando…» hasta la respuesta, luego refleja el valor devuelto. Así el estado mostrado siempre es el del servidor; el costo (≈200 ms sin feedback de cambio) es aceptable para una tarea administrativa.
- Avisos con los toasts existentes («Stock actualizado», «<producto> ya no se ofrece en el catálogo» / «… vuelve a ofrecerse»).

### D6 — Formulario de producto y pedido único
- Misma página, como C-15/C-17a (`{tipo:'alta'|'edicion', id}`), foco en el título, «Volver a Productos y stock». En edición se carga el detalle de gestión (`GET /productos/{id}`, visible para ADMIN aunque no esté disponible).
- TanStack Form con validación pura en `model/validacion.ts`: nombre (`trim`, 1..150), precio (`/^\d+(\.\d{1,2})?$/`, se acepta coma decimal y se normaliza a punto), stock inicial (entero ≥ 0, solo alta), categorías (≥1), ingredientes (cantidad `/^\d+(\.\d{1,3})?$/` > 0, sin repetidos).
- Alta: `POST /productos/` con todo. Edición: `PUT /productos/{id}` con el **diff** contra los valores iniciales; `categoria_ids` solo si cambió el conjunto o la principal; `ingredientes` solo si cambió algo de la lista (se envía completa: el backend reemplaza). Sin cambios → vuelve sin pedir.
- Decimales viajan como **string** (`precio_base: "2500.00"`, `cantidad: "2"`) para no perder precisión (igual que el resto del contrato).
- Stock y disponibilidad **no** están en el formulario de edición: tienen un único camino (la fila) con su endpoint idempotente y su permiso compartido con STOCK. En el alta sí (valores iniciales del `POST`).
- 409 `DUPLICATE_VALUE` `field=nombre` → error en «Nombre»; 404 (categoría/ingrediente/unidad borrados mientras se editaba) y 422 → alerta general y se invalidan árbol e ingredientes; red caída → alerta general conservando lo escrito.

### D7 — Categorías e ingredientes en el formulario
- Categorías: lista de casillas en orden de árbol (indentadas, de `padresPosibles(arbol)`), y un `<select>` «Categoría principal» con las marcadas (por defecto la primera marcada; si se desmarca la principal pasa a la siguiente). Se envía la principal primero.
- Ingredientes: filas editables (`ingrediente` `<select>` con los activos de `ingredienteQueries.lista({page:1,size:100})`, alérgenos con «(alérgeno)» en la opción y marca en la fila; `cantidad`; `unidad` `<select>`; casilla «Se puede quitar»; botón «Quitar <ingrediente>»), más «Agregar ingrediente». Al elegir un ingrediente la unidad se propone con su `unidad_medida_id` (por eso el arreglo de backend D9 es prerequisito) y la cantidad con 1.
- Ayuda visible: «"Se puede quitar" permite que el cliente lo saque al personalizar su pedido.»

### D8 — Backend: bug de C-11 (decisión: se arregla en este change)
- Se arregla porque el formulario lo necesita: sin él, guardar un producto con ingredientes exige `POST` + N `POST /{id}/ingredientes` no atómicos (un fallo a mitad deja un producto incompleto visible en el catálogo) y la edición no podría quitar/cambiar ingredientes en un pedido. El bug afecta también a `update`, no solo a `create`.
- En `ProductoService`: un helper privado `_vincular_ingrediente(producto_id, entrada)` (valida ingrediente activo y unidad existente → 404; crea o actualiza el link con `cantidad`, `unidad_medida_id`, `es_removible`) reutilizado por `create`, `update` (tras borrar los links anteriores) y `asociar_ingrediente` (DRY: hoy son tres copias, dos de ellas rotas). Igual para categorías con `_vincular_categorias`.
- Repetidos: validadores Pydantic en `ProductoCreate`/`ProductoUpdate` (`ingrediente_id` y `categoria_ids` únicos → 422 con el formato de error existente). Así nunca llega a la PK compuesta.
- `create` también valida `unidad_venta_id` si viene (hoy solo lo valida `update`): mismo helper.

### D9 — Backend: unidad del ingrediente
- `IngredienteRead` agrega `unidad_medida_id: int` (lo heredan `IngredienteReadFull` y las respuestas de alta/edición); `_to_read_full` lo copia. `IngredienteUpdate` agrega `unidad_medida_id: Optional[int]`.
- `IngredienteService._validar_unidad(id)` (404 «Unidad de medida no encontrada» si no existe o está eliminada) en `create` y `update`; `IngredienteUnitOfWork` suma el repo de unidades si no lo tiene. Sin migración: la columna ya es `NOT NULL` con FK.
- Se devuelve solo el id (no la unidad anidada): el frontend ya tiene la lista de unidades en caché (YAGNI).

### D10 — Seguimiento de C-17a en `pages/admin-ingredientes`
- `Ingrediente.unidad_medida_id: number` pasa a obligatorio; se elimina la opción «Sin cambios» y la rama `''` de `valoresInicialesIngrediente`; la fila muestra siempre `etiquetaUnidad`. `cambiosIngrediente` ya incluye `unidad_medida_id` cuando cambia.

### D11 — Tests
- **Backend** (pytest, PostgreSQL real `foodstore_test`): `tests/integration/test_ingrediente_unidad.py` (lecturas con `unidad_medida_id`, PATCH, 404 alta/edición, 403 STOCK) y `tests/integration/test_producto_alta_con_ingredientes.py` (alta y PUT con ingredientes, reemplazo, omitir lista, 404 unidad/ingrediente, 422 repetidos y cantidad 0, rollback sin producto creado). `test_producto_ingredientes.py` sigue verde (regresión de `asociar_ingrediente`).
- **Frontend** (Vitest + RTL + MSW): `src/test/msw/admin-productos.ts` con los 6 productos del seed, estado en memoria, registro de cuerpos, filtros y variantes (409, 404, 422, red caída, demora). Sesiones ADMIN, STOCK, ADMIN+STOCK y CLIENT (`src/test/sesion.ts`). axe sin violaciones por pantalla.

### D12 — Íconos y estilos
- Íconos nuevos solo si el mockup aprobado los usa: el mockup propone `i-guardar` (tilde) para «Guardar stock». El interruptor es CSS (`.switch`), sin ícono.
- CSS `admin-productos.css` importado en `app/styles/index.css` antes de cualquier regla (lección V-1 de C-16b, test `styles-compile`).

## Risks / Trade-offs

- [Selector de ingredientes limitado a 100 (tope de `size`)] → el seed tiene 12; OQ-1.
- [Interruptor no optimista se siente más lento] → feedback inmediato «Guardando…» y botón deshabilitado; evita mostrar un estado que el servidor rechazó.
- [Dos usuarios editando stock a la vez] → el `PATCH` es absoluto e idempotente; gana el último. Se muestra siempre el valor devuelto; sin bloqueo optimista (no especificado).
- [`PUT` con `ingredientes` borra y recrea links] → misma transacción; si falla una validación hace rollback total (test explícito).
- [Validadores de unicidad en schemas cambian 500 → 422 en pedidos que antes «funcionaban» a medias] → nunca funcionaron (500); sin consumidores previos en el frontend.
- [Página compartida por dos roles] → tests de permisos por rol en cada pantalla (STOCK no ve ni dispara escrituras de ADMIN).

## Migration Plan

Sin migraciones Alembic (no cambia el esquema) ni flags. Orden: backend (D9, D8) → frontend. Rollback = revertir el commit; la ruta vuelve a `PlaceholderPage` y la API a su contrato anterior (el campo `unidad_medida_id` es aditivo).

## Open Questions

- **OQ-1** (no bloquea): con más de 100 ingredientes activos el selector necesitará búsqueda (`q` no existe en `/ingredientes/`). Por defecto: una página de 100 y se revisa si el catálogo crece.
- **OQ-2** (no bloquea): ¿la baja de un producto con pedidos en curso debería avisar o bloquearse? El backend permite el soft delete (RN-PR-06, `RESTRICT` solo protege la integridad). Por defecto: confirmar sin aviso extra.
- **OQ-3** (no bloquea): orden del listado de gestión: el del servidor (`id` ascendente). Por defecto: sin selector de orden.

## UI Mockups

- Design system revision: 2 (`design-system/README.md`, `Mode: system-and-mockups`, aprobada 2026-11-14)
- Decision: yes (2026-11-18)
- Mockups: `mockups/` (`productos.html`, `producto-form.html`, `producto-eliminar.html`, `ingredientes-unidad.html`, `mockup.css`, `mockup.js`, `admin.js`, `README.md`, `previews/`)
- Approval: approved (2026-11-18, by user) — OQ-1, OQ-2 y OQ-3: por defecto
- Preview: rendered (2026-11-18, headless Microsoft Edge + `playwright-core` desde `file://`, «reducir movimiento», 1440x900 y 390x844; Playwright MCP no disponible). Capturas en `mockups/previews/` (14 pantallas/estados × 2 tamaños + `drawer-stock-mobile.png`), páginas completas en `previews/full/` y 6 láminas en `previews/resumen/`. Inspeccionadas y corregidas: rótulo «Stock» visible en mobile (no hay encabezado de columnas), filtro segmentado sin cortar «No disponibles» en 390 px, marca «Alérgeno» de la fila de ingrediente junto al rótulo para alinear «Se puede quitar». Sin errores de consola ni scroll horizontal.
- Visual verify: passed (2026-11-18) — dev server + headless Edge, `/api/v1` simulada con `page.route` (ADMIN y STOCK), 14 pantallas/estados x 2 tamaños + drawer STOCK en `mockups/verify/` y 6 comparativas en `mockups/verify/comparativas/`. Sin errores de consola ni scroll horizontal (solo los fallos de red simulados a propósito). Corregido: marca «Alérgeno» de la fila de ingrediente junto al rótulo (`Campo` con prop `marca`). Diferencias menores aceptadas: resumen «N productos» sin «· M no disponible» (el listado es paginado, no hay conteo), «Quedan N» con la insignia compartida de C-16b en vez de texto plano, aviso «Producto creado» sin la frase «ya se ve en el catálogo», botón del diálogo de baja sigue diciendo «Eliminar» tras el error (el mockup dice «Reintentar»), filtro segmentado de ingredientes de C-17a ya presente.

Estados visibles y cobertura:

| Estado | Mockup |
|--------|--------|
| Listado ADMIN con recién creado (resaltado + toast) | `productos.html` |
| Listado STOCK (sin alta, edición ni baja) | `productos.html?rol=stock` |
| Fila: stock cambiado, inválido, interruptor guardando, aviso | `productos.html?rol=stock&estado=stock` |
| Carga / búsqueda sin resultados / error | `productos.html?estado=carga\|vacio\|error` |
| Alta con categorías e ingredientes | `producto-form.html` |
| Errores de validación / edición sin stock / nombre repetido (409) | `producto-form.html?modo=errores\|editar\|duplicado` |
| Confirmar baja / error en la baja | `producto-eliminar.html`, `?estado=error` |
| Ingredientes con unidad / edición con unidad preelegida | `ingredientes-unidad.html`, `?modo=editar` |
| Panel lateral del rol STOCK en mobile | `productos.html?rol=stock&nav=drawer` |
