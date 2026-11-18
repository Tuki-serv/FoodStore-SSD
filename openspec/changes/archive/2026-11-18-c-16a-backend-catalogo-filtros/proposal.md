# Proposal — C-16a `backend-catalogo-filtros`

> C-16 se partió en dos changes (2026-11-18), como C-13a/C-13b: **C-16a** (este, backend: filtros del listado público de productos) y **C-16b** `fe-catalogo-publico` (frontend: catálogo, árbol de categorías y detalle). C-16b depende de C-16a.

## Why

US-007 (Épica 3) pide filtrar el catálogo por categoría, nombre, **rango de precio** y **disponibilidad** con paginación `page/size`. El listado público `GET /api/v1/productos/` no tiene filtro de precio ni de stock, y al filtrar por varias categorías o ingredientes devuelve filas duplicadas y cuenta mal el `total`. Sin estos arreglos el frontend del catálogo (C-16b) no puede cumplir US-007 ni paginar correctamente: filtrar precio/stock en el cliente sobre la página actual rompe `total`/`pages`.

Observado en el repo (`dev`, 2026-11-18):

- `GET /api/v1/productos/` (público, `lector_privilegiado`) acepta `page`/`size` (1..100, defecto 20), `q` (busca **solo en `nombre`**, `ILIKE`), `categoria_ids` (lista), `ingrediente_ids`, `disponible` y `estado`; ordena por `id` ascendente. Devuelve `Paginado<ProductoReadFull>` con `precio_base` como string decimal (`Numeric(10,2)`) y `stock_cantidad`.
- **No hay filtro de precio** (`precio_min`/`precio_max`) ni de «con stock».
- **Duplicados con varias categorías/ingredientes**: `ProductoRepository.get_all_filtered` y `count_filtered` (`backend/app/modules/productos/repository.py`, ~líneas 49-52 y 75-78) hacen `JOIN producto_categoria … IN (…)` / `JOIN producto_ingrediente … IN (…)` sin `DISTINCT`: un producto vinculado a dos de los ids pedidos aparece dos veces y `total` lo cuenta dos veces. Con el seed pasa con «Burger Vegana» (Hamburguesas + Veganas) al filtrar «Hamburguesas» con sus subcategorías.
- Los filtros están **duplicados** entre `get_all_filtered` y `count_filtered` (viola la regla dura 5, DRY).
- El `Query(description=…)` de `q` en `router.py` dice «Buscar en nombre o descripción», pero el código y la KB («nombre, búsqueda parcial») usan solo `nombre`.
- Para el público el backend fuerza `disponible = true` (spec `catalog-visibility`); ADMIN/STOCK con sesión ven no disponibles si no envían `disponible`.

## What Changes

- `GET /api/v1/productos/` suma tres parámetros opcionales: `precio_min` y `precio_max` (decimales ≥ 0, extremos incluidos; `precio_min > precio_max` → 422 `VALIDATION_ERROR` con `field` `precio_max`; negativo → 422 con el campo correspondiente) y `con_stock` (`true` → solo `stock_cantidad > 0`).
- Los filtros por `categoria_ids`/`ingrediente_ids` pasan de `JOIN` a `EXISTS` (subconsulta correlacionada): cada producto aparece una sola vez en `items` y cuenta una sola vez en `total`.
- Los filtros comunes del listado y del conteo se centralizan en un único `_aplicar_filtros` del repositorio (DRY).
- Se corrige la descripción OpenAPI de `q` a «Buscar en nombre» (sin cambiar el comportamiento: manda la KB).
- Los filtros nuevos intersectan con la visibilidad (`catalog-visibility`) y nunca la amplían.

**Fuera de alcance (con dueño):** toda la UI del catálogo, el árbol de categorías en pantalla y el detalle de producto (C-16b); ordenamiento del listado (no especificado; sigue por `id`); búsqueda en `descripcion` (la KB pide solo `nombre`); auto-marcar no disponible con stock 0 (PA-12).

## Capabilities

### New Capabilities
- `catalog-search`: filtros de búsqueda del listado público de productos en el backend (rango de precio, solo con stock, resultados sin duplicados al filtrar por varias categorías o ingredientes).

### Modified Capabilities
_(ninguna: `catalog-visibility` no cambia —los filtros nuevos intersectan con lo visible—; `api-conventions` ya define el formato de error y la paginación.)_

## Impact

- **Código modificado** (`backend/app/modules/productos/`): `router.py` (parámetros nuevos y descripción de `q`), `service.py` (`get_all_productos` recibe y valida el rango), `repository.py` (`_aplicar_filtros`, `EXISTS`, precio y stock).
- **Tests nuevos**: `backend/tests/integration/test_producto_filtros.py` (pytest contra PostgreSQL real, `backend/tests/.env.test`).
- **Sin migración**: no cambia el esquema. **Dependencias**: ninguna nueva.
- **Consumidor**: C-16b envía `precio_min`, `precio_max`, `con_stock` y la categoría elegida con todas sus subcategorías en `categoria_ids`.
- **Docs al cerrar**: `knowledge-base/06_funcionalidades.md` (US-007: filtros de precio y stock disponibles en el backend), `CHANGES.md` (cierre de C-16a y «Punto de partida (C-16a)» en C-16b).
- **Governance BAJO**: lectura pública acotada, sin esquema ni auth; autonomía total si los tests pasan. Sin UI: no requiere mockups.
