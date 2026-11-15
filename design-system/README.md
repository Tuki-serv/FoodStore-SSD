# Food Store - Design System

- Mode: system-and-mockups
- Revision: 2
- Approval: approved (2026-11-14, by user)
- Decision source: user chose `system-and-mockups` (2026-11-03)

## Purpose
Shared visual foundation for the Food Store frontend (React + TS + Vite + Tailwind) and per-change mockups. Provisional: no prior brand existed.

## Revision history
- Revision 1: approved (2026-11-03, by user). Top navbar (`.topnav`).
- Revision 2: approved (2026-11-14, by user). The top navbar is replaced by a left sidebar for the whole app (KB DD-25, requested by the course coordinator). Desktop (>= 1024px): collapsible to icons only. Mobile: hidden behind a menu button, opens as a drawer over the content. Colors, type, spacing and every other component are unchanged. No change mockup existed under Revision 1, so nothing needs re-rendering.

## Sources
- knowledge-base/README.md, 01, 02, 03, 06, 08, 13 (product, actors, stack)
- knowledge-base/05_reglas_de_negocio.md (order FSM: PENDIENTE, CONFIRMADO, EN_PREP, EN_CAMINO, ENTREGADO, CANCELADO)
- knowledge-base/09_decisiones_y_supuestos.md DD-25 (sidebar navigation and sections per role)
- No existing logo/palette/typography found.

## Files
- `brand.md` brand facts and tone; `brand.js` name constant bound to `[data-brand-name]`
- `tokens.css` color, type, spacing, radii, shadow, focus, motion and app-shell tokens (+ reduced motion). Since C-13a the frontend imports it as is and the Tailwind theme only references these variables (`frontend/tailwind.config.ts`, checked by a test)
- `components.html` component and state reference; `assets/logo.svg` provisional logo
- `previews/components-desktop.png` (1440 wide, full page), `previews/components-mobile.png` (390 wide, full page)
- `previews/nav-desktop-expanded.png`, `previews/nav-desktop-collapsed.png` (1440x900)
- `previews/nav-mobile-closed.png`, `previews/nav-mobile-drawer.png` (390x844)

## Sidebar navigation (Revision 2)
- Tokens: `--sidebar-width` (264px), `--sidebar-width-collapsed` (72px), `--topbar-height` (56px, mobile only), `--color-overlay`, `--z-topbar`, `--z-scrim`, `--z-drawer`. Breakpoint: 1024px.
- Markup reference: `.shell` > `.sidebar` (`.sidebar-head`, `.sidebar-nav`, `.sidebar-foot`) + `.shell-main` (`.topbar` on mobile, then the page).
- States: `.sidebar.is-collapsed` (desktop, icons only, label shown as tooltip); `.shell.drawer-open` (mobile). In the app these map to `uiStore.sidebarCollapsed` (persisted) and `uiStore.sidebarOpen` (not persisted).
- Item states: normal, hover, keyboard focus, current page (`aria-current="page"`), with counter.
- Sections per role (`data-roles` in the markup): no session = Catálogo, Ingresar, Registrarse; CLIENT = Catálogo, Carrito, Mis pedidos, Direcciones, Mi cuenta; PEDIDOS = CLIENT + Gestión de pedidos; ADMIN = all + group «Administración» (Categorías, Ingredientes, Productos y stock, Usuarios, Dashboard).
- Transitions are enabled only after the first render (`.shell.is-ready`), so a saved collapsed state does not animate on load.
- Preview helpers in `components.html`: `?nav=collapsed`, `?nav=expanded`, `?nav=drawer`.

## Open decisions (TBD)
- Final product name and logo (placeholder is labeled "LOGO PROVISIONAL (TBD)")
- Compact logo mark for the collapsed sidebar (today the logo is hidden when collapsed)
- Product photography style (Cloudinary images)
- Final palette approval (terracotta primary, basil green accent, warm cream background)
- Icons `obra`, `brujula` and `alerta` used by the app (C-13a) are not yet in the `components.html` sprite; adding them is a visual change that needs user review (tracked in CHANGES.md C-25b)
- Copy details: delivery time estimate, cash/transfer payment options (KB PA-06)
- Role COCINA / KDS screens not specified by spec (KB PA-07, PA-19); no components or sidebar section defined for them

## Replacement steps
1. Name: edit `BRAND_NAME` in `brand.js` AND the constant in `frontend/src/shared/config/brand.ts` (the app keeps its own copy since C-13a).
2. Logo: replace `assets/logo.svg` keeping the path; remove the "LOGO PROVISIONAL" text.
3. Colors/type/spacing: edit values in `tokens.css` only; bump `Revision:` and reset Approval to pending.
4. Re-render `components.html` at 390x844 and 1440x900 into `previews/`.

## Preview note
Playwright MCP could not launch in Revision 1 (Chrome not installed), so captures are taken with headless Microsoft Edge straight from the local file (no server). The 390px captures are rendered inside a 390px iframe because headless Edge does not go narrower than about 500px; they were inspected and show no horizontal overflow. In the full-page desktop capture the sidebar is as tall as the whole page because the capture window is that tall; the 1440x900 captures show the real proportions.
