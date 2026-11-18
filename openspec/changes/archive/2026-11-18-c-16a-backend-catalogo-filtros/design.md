# Design — C-16a `backend-catalogo-filtros`

## Context

Motivación y estado observado: ver `proposal.md` (Why). C-16a es la parte backend de C-16 (partido el 2026-11-18); la parte frontend es C-16b `fe-catalogo-publico`, que consume estos filtros.

Restricciones:

- **Capas** (regla dura 1-2): `models ← repository ← unit of work ← services ← routers`. El router solo declara parámetros y delega; la validación de negocio (`min > max`) va en el service, que no conoce FastAPI y lanza `AppError` (C-25a); las consultas viven en el repositorio.
- **DRY** (regla dura 5): hoy `get_all_filtered` y `count_filtered` repiten los mismos `where`/`join`.
- **Sin cambio de esquema** (regla dura 9): no hay migración.
- **Visibilidad** (`catalog-visibility`, C-08): el público solo ve `disponible = true` y no eliminados; ADMIN/STOCK ven no disponibles si no envían `disponible`. Los filtros nuevos se suman a eso.
- **Tests**: pytest de integración contra PostgreSQL 15 real (`foodstore_test`, `backend/tests/.env.test`), TDD estricto.

### Contrato actual (verificado 2026-11-18)

| Método y ruta | Parámetros | Respuesta | Notas |
|---------------|-----------|-----------|-------|
| `GET /api/v1/productos/` | `page` ≥ 1, `size` 1..100 (defecto 20), `q`, `categoria_ids` (repetido), `ingrediente_ids` (repetido), `disponible`, `estado` | 200 `Paginado<ProductoReadFull>`, orden `id` ascendente | Público. `q` solo busca en `nombre` (`ILIKE %q%`). **Sin** filtro de precio ni de stock. **Duplica** filas con varios `categoria_ids`/`ingrediente_ids` (JOIN sin `DISTINCT`, `repository.py` ~49-52 y ~75-78) |
| `GET /api/v1/productos/{id}` | — | 200 `ProductoReadFull` | Sin cambios en este change |

- `precio_base` es `Numeric(10,2)` (string decimal en JSON); `stock_cantidad` entero; la relación con categorías es `producto_categoria` (N:M con `es_principal`) y con ingredientes `producto_ingrediente`.
- Seed: «Burger Vegana» y «Burger Sin TACC» en dos categorías («Hamburguesas» + subcategoría), 6 productos de $ 700 a $ 1.900.

**KB ↔ backend**: US-007 pide filtro de rango de precio y de disponibilidad que el backend no tiene (D1, D2); el `description` de `q` en el router dice «buscar en nombre o descripción», pero el código y la KB («nombre, búsqueda parcial») usan solo `nombre`: se respeta la KB y se corrige el texto (D5).

## Goals / Non-Goals

**Goals:**
- Que C-16b pueda filtrar por precio y stock en el servidor con `total`/`pages` correctos.
- Resultados sin duplicados al pedir varias categorías o ingredientes.
- Un único lugar donde se arman los filtros del listado y del conteo.

**Non-Goals:**
- UI del catálogo (C-16b).
- Ordenamiento configurable, búsqueda en `descripcion`, conteo de productos por categoría en el árbol.
- Cambiar la visibilidad del catálogo (`catalog-visibility`).

## Decisions

### Decisiones del usuario (2026-11-18)

Las preguntas OQ-1..OQ-3 que planteaba el C-16 original quedaron resueltas por el usuario con su valor por defecto; C-16b las referencia desde aquí.

- **DU-1 (ex OQ-1) — Filtro de rango de precio en el backend.** Se agregan `precio_min`/`precio_max` a `GET /productos/` (D1). *Alternativa descartada*: filtrar precio en el cliente sobre la página actual (rompe `total`/`pages`) o sacar el filtro de la UI.
- **DU-2 (ex OQ-2) — «Disponibilidad» para el público = «Solo con stock».** El público ya solo ve `disponible = true`; el filtro de la UI es `con_stock=true` (oculta los agotados), con soporte en el backend (D2). *Alternativa descartada*: sin filtro de disponibilidad (los agotados siempre visibles con la marca «Agotado»).
- **DU-3 (ex OQ-3) — Categoría con subcategorías, sin duplicados.** El backend deja de duplicar (`EXISTS`, D3) y el frontend (C-16b) envía la categoría elegida **más todas sus descendientes** en `categoria_ids`. *Alternativa descartada*: enviar solo el id elegido (elegir «Hamburguesas» no mostraría productos que estén solo en «Veganas»).

### D1 — Rango de precio

- `router.py`: `precio_min: Annotated[Optional[Decimal], Query(ge=0)] = None`, `precio_max: Annotated[Optional[Decimal], Query(ge=0)] = None`; un negativo lo rechaza la validación de FastAPI → 422 `VALIDATION_ERROR` con `field` del parámetro (formato único de error, `api-conventions`).
- `service.get_all_productos`: si ambos vienen y `precio_min > precio_max` → `AppError(422, ErrorCode.VALIDATION_ERROR, "El precio mínimo no puede superar al máximo", field="precio_max")`. El service no importa FastAPI (C-25a).
- `repository`: `precio_base >= precio_min` y/o `precio_base <= precio_max` (extremos incluidos; cada uno puede usarse solo).

### D2 — Solo con stock

- `con_stock: Optional[bool] = None` en el router → service → repositorio. `True` agrega `stock_cantidad > 0`; `False` u omitido no filtra (no existe «solo agotados»: no lo pide la KB).

### D3 — `EXISTS` en lugar de `JOIN`

- `categoria_ids` → `exists().where(ProductoCategoria.producto_id == Producto.id, ProductoCategoria.categoria_id.in_(ids))` (subconsulta correlacionada); ídem `ingrediente_ids` con `ProductoIngrediente`. Semántica sin cambios: un producto entra si coincide con **alguno** de los ids (OR), ahora una sola vez.
- *Alternativas descartadas*: (a) `DISTINCT` sobre la fila de `Producto`: `imagenes_url` es `ARRAY` y `DISTINCT` sobre arrays complica el plan y el `ORDER BY`; (b) `GROUP BY Producto.id`: obliga a agregar en el conteo y mezcla paginación con agregación. `EXISTS` sirve igual para el listado y para `count()`.

### D4 — `_aplicar_filtros` único

- `ProductoRepository._aplicar_filtros(statement, *, state, disponible, q, categoria_ids, ingrediente_ids, precio_min, precio_max, con_stock)` agrega todos los `where` (incluido `_filter_state`) a cualquier `select`; `get_all_filtered` lo aplica a `select(Producto)` (+ `order_by`, `offset`, `limit`, carga de relaciones) y `count_filtered` a `select(func.count()).select_from(Producto)`. Un único lugar evita que listado y conteo diverjan (la causa raíz de `total` mal contado).
- Las firmas públicas de `get_all_filtered`/`count_filtered` suman los tres parámetros nuevos como opcionales con defecto `None`: los demás llamadores no cambian.

### D5 — Descripción de `q`

- Se cambia el `description` de `q` en `router.py` a «Buscar por nombre (búsqueda parcial)». Comportamiento sin cambios (`ILIKE` solo en `nombre`, KB US-007). Riesgo nulo: solo cambia el OpenAPI.

### D6 — Tests

- Archivo nuevo `backend/tests/integration/test_producto_filtros.py`, un test por escenario de la spec `catalog-search`, AAA, nombres `test_<unidad>_<escenario>_<resultado>`, datos propios por test (no depende del seed).
- Línea base previa: `tests/integration/test_producto.py`, `test_catalogo_visibilidad.py`, `test_paginacion_listados.py` (deben seguir verdes sin tocarlos).

## Risks / Trade-offs

- **R1 [Rendimiento de `EXISTS`]** Subconsulta correlacionada por fila. → Las tablas intermedias tienen PK compuesta `(producto_id, categoria_id)`/`(producto_id, ingrediente_id)`; con el volumen del TPI es irrelevante.
- **R2 [Decimal en query string]** `precio_min=1000.5` es válido para el backend; el frontend (C-16b) solo envía enteros. → Aceptado: la spec habla de decimales ≥ 0.
- **R3 [`q` solo por nombre]** «sin TACC» no encuentra productos cuya descripción lo diga. → Fiel a la KB; el árbol cubre ese caso con la categoría «Sin TACC».

## Migration Plan

Sin migración de datos ni de esquema. Apply: tareas de `tasks.md` en orden. Rollback: revertir el commit. C-16b puede empezar su apply cuando C-16a esté cerrado (o al menos con el bloque de backend verde en `dev`).

## Open Questions

_(ninguna: OQ-1..OQ-3 del C-16 original quedaron resueltas por el usuario el 2026-11-18, ver «Decisiones del usuario». Las preguntas de frontend OQ-4..OQ-6 viven en C-16b.)_

## UI Mockups

- Design system revision: no aplica
- Decision: no (no UI) (2026-11-18)
