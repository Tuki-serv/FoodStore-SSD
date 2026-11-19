# Design — Filtros del catálogo arriba

## Context

`CatalogoPage` (`frontend/src/pages/catalogo/ui/catalogo-page.tsx`) usa `useMediaQuery('(min-width: 1024px)')`: en escritorio renderiza `<aside className="filters">` con `ContenidoFiltros` y en menos de 1024 px `BarraMobile` + `HojaFiltros`. El modelo (`../model`) ya resuelve URL ↔ filtros ↔ API y no se toca. Los tests corren a 1440 px por defecto (`src/test/viewport.ts`), así que los de `catalogo-filtros.test.tsx` hoy ejercitan la columna.

## Goals / Non-Goals

**Goals:** sacar la columna; barra superior en todos los anchos; en escritorio, subcategorías, «Precio ▾» y «Solo con stock» en línea.

**Non-Goals:** cambiar mobile, el modelo de filtros, los chips de filtros activos, la grilla/tarjetas o el detalle.

## Decisions

- **D1 — Una barra, dos variantes.** `BarraMobile` pasa a `BarraCategorias` (mismos chips de raíz, `aria-pressed`). Mobile agrega el botón «Filtros»; escritorio agrega `PopoverPrecio` + `FiltroStock` (compacto, sin texto de ayuda visible, la ayuda queda como `aria-describedby`) y la fila de subcategorías. Alternativa descartada: mantener el árbol en un popover «Categorías» (un clic extra para lo más usado).
- **D2 — Segunda fila.** Se muestra solo si la raíz actual tiene hijos. Su «Todas» elige la raíz; cada chip elige la subcategoría (con nietos, filtra por su subárbol como hoy). Grupo con `aria-label="Subcategorías de <raíz>"`.
- **D3 — `PopoverPrecio`.** Botón «Precio» con `aria-expanded`/`aria-controls`; el panel es un `role="dialog"` no modal con `aria-label="Precio"` que reutiliza `FormularioPrecio` tal cual (misma validación). Al abrir, foco en «Precio mínimo»; Escape, clic afuera o aplicar válido cierra y devuelve el foco al botón; error de rango mantiene abierto. Con rango aplicado el botón muestra el resumen («$ 1.000 – $ 2.000») y estado activo. Sin librería nueva.
- **D4 — Layout.** Se borra `.cat-layout` en dos columnas y `.filters`; `.prod-grid` (`auto-fill, minmax(220px,1fr)`) gana una columna sola. CSS nuevo con tokens existentes (`.pill`, `.chip`, `.switch`, sombra/radio de `.modal`).
- **D5 — Tests (TDD en apply).** En `catalogo-filtros.test.tsx` los selectores pasan de `navigation «Categorías»` a los grupos de chips, y los de precio abren antes «Precio»; se suman los escenarios del spec (segunda fila, Escape, foco). La aserción «sin `complementary` Filtros» se agrega también en escritorio. `catalogo-mobile.test.tsx` no debería cambiar.

## Risks / Trade-offs

- El árbol de 3+ niveles en escritorio se ve como dos filas (raíz + hijos directos); los nietos solo se alcanzan en la hoja mobile. Con el seed actual (2 niveles) no hay pérdida; se anota como pregunta abierta.
- Popover propio: hay que cuidar el cierre por clic afuera y el foco; se cubre con tests.

## UI Mockups

- Design system revision: 2
- Decision: yes (2026-11-19)
- Mockups: `openspec/changes/fe-catalogo-filtros-arriba/mockups/` (fuente: mockups aprobados de C-16b en `openspec/changes/archive/2026-11-18-c-16b-fe-catalogo-publico/mockups/`)
- Approval: approved (2026-11-19, by user). Decisiones confirmadas: en escritorio solo dos niveles de categoría (raíz + subcategorías); el botón «Precio» muestra el rango aplicado (p. ej. «Precio: $ 1.000 – $ 2.000»).
- Preview: rendered (2026-11-19, headless Edge; `mockups/previews/catalogo-escritorio-desktop.png`, `catalogo-escritorio-mobile.png`, `catalogo-mobile-desktop.png`, `catalogo-mobile-mobile.png`)
- Visual verify: passed (2026-11-19, built-in browser con backend y frontend reales; capturas en `mockups/verify/`). Coinciden: barra sin columna lateral, 4 columnas, fila de subcategorías, botón «Precio» con el rango, «Solo con stock», chips y móvil sin cambios; Escape cierra el panel y devuelve el foco; sin errores de consola ni requests fallidas. La diferencia menor del panel «Precio» (Aplicar a todo el ancho, sin la ayuda) se corrigió con la prop opcional `ayuda` de `FormularioPrecio` (la hoja móvil no la usa); captura `mockups/verify/escritorio-panel-precio-ajustado-1440.jpg`. Móvil capturado a 375x812, no 390x844.
