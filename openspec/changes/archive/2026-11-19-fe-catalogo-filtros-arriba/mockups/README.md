# Mockups — `fe-catalogo-filtros-arriba`

- Design system revision: 2 (`design-system/README.md`, aprobada 2026-11-14)
- Approval: approved (2026-11-19, by user). Decisiones confirmadas: en escritorio solo dos niveles de categoría (raíz + subcategorías); el botón «Precio» muestra el rango aplicado (p. ej. «Precio: $ 1.000 – $ 2.000»).
- Preview: rendered (2026-11-19, headless Microsoft Edge desde `file://`, 1440x900 y 390x844 en iframe, con «reducir movimiento»; Playwright MCP no arranca: falta Chrome)

Base: mockups aprobados de C-16b (`openspec/changes/archive/2026-11-18-c-16b-fe-catalogo-publico/mockups/`). `mockup.css`, `mockup.js` y `catalogo.js` se copiaron **sin cambios**; lo nuevo está solo en `filtros-arriba.css` y `filtros-arriba.js` (tokens existentes, ningún componente nuevo del design system: reutiliza `.pill`, `.chip`, `.switch`, `.range`, sombra/radio de `.modal`).

## Pantallas

| Archivo | 1440 px | 390 px |
|---------|---------|--------|
| `catalogo-escritorio.html` | Sin columna lateral. Chip «Hamburguesas» elegido, segunda fila «Todas / Sin TACC / Veganas», botón «Precio: $ 1.000 – $ 2.000» activo con su panel abierto (mínimo, máximo, «Aplicar»), «Solo con stock» encendido, chips de filtros activos y 4 productos en 4 columnas. | Igual que C-16b: chips de raíz + «Filtros 3» (el panel no existe en mobile). |
| `catalogo-mobile.html` | Barra nueva sin categoría elegida: «Todas» marcada, «Precio» sin rango, «Solo con stock» apagado, 20 productos en 4 columnas (antes 3). | Referencia mobile **sin cambios** respecto de C-16b. |

Lo nuevo y su comportamiento esperado (ver `design.md` D1–D3): la segunda fila aparece solo si la raíz tiene subcategorías; el panel «Precio» se cierra con Escape, clic afuera o «Aplicar» válido y devuelve el foco al botón; con rango inválido queda abierto con el error junto al campo (igual que hoy).

## Capturas (`previews/`)

- `catalogo-escritorio-desktop.png` / `catalogo-escritorio-mobile.png`
- `catalogo-mobile-desktop.png` / `catalogo-mobile-mobile.png`

## Cómo previsualizar

1. Abrir el `.html` en el navegador (sin servidor). Rutas a `design-system/`: `../../../../design-system/` (al archivar, `../../../../../`).
2. Mobile: ventana de menos de 1024 px.
3. Re-render: `msedge --headless=new --hide-scrollbars --force-prefers-reduced-motion --window-size=1440,900 --screenshot=<png> <url>`; para 390 px, un HTML contenedor con un iframe de 390x844 y `--window-size=390,844`.
