# Proposal — Filtros del catálogo arriba (ajuste visual de C-16b)

## Why

En C-16b el catálogo público pasa, desde 1024 px, a una columna lateral de 248 px con el árbol de categorías, el precio y el stock. El usuario la aprobó en su momento, pero ahora prefiere la versión con barra superior (la de mobile): le saca ancho a la grilla y separa los filtros del buscador. Es un ajuste visual chico, fuera de los 32 changes del roadmap.

## What Changes

- Se elimina la columna lateral de filtros en todos los anchos; la grilla usa el ancho completo (una columna de productos más en escritorio).
- La barra superior (buscador + chips de categorías raíz «Todas / …») queda en todos los anchos.
- En escritorio (>= 1024 px) los filtros van en la barra, sin hoja:
  - con una categoría raíz elegida aparece una segunda fila de chips con sus subcategorías («Todas» de esa raíz vuelve a la raíz);
  - «Precio ▾» abre un popover con mínimo/máximo y «Aplicar» (misma validación y semántica de hoy);
  - interruptor «Solo con stock» al lado.
- Mobile/tablet (< 1024 px) sin cambios: chips + botón «Filtros» que abre la hoja.
- Sin cambios en el modelo de filtros (URL, `aParametrosApi`, `contarFiltros`), chips de filtros activos ni contador de resultados.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `frontend-catalog`: el árbol de categorías deja de ser una columna lateral; en escritorio las categorías se navegan con chips de raíz y subcategoría y el precio/stock van en la barra superior.

## Impact

- Código: `frontend/src/pages/catalogo/ui/` (`catalogo-page.tsx`, `barra-mobile.tsx` → barra común, nuevo popover de precio, `catalogo.css`). `contenido-filtros.tsx`/`formulario-precio.tsx`/`filtro-stock.tsx` se reutilizan.
- Tests: `frontend/src/pages/catalogo/__tests__/catalogo-filtros.test.tsx` (hoy usa la `navigation` «Categorías» y los campos de precio visibles en escritorio) y `catalogo-mobile.test.tsx` (aserción de que no hay `complementary` «Filtros» pasa a valer en todos los anchos).
- Sin cambios de backend, API ni dependencias. Gobernanza BAJO (solo presentación).
