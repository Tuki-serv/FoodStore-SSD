# Food Store - Design System

- Mode: system-and-mockups
- Revision: 4
- Approval: approved (2026-11-23, by user)
- Last approved: Revision 3 (2026-11-21). `.active-orchestrator-state.json` keeps `visual_design.revision: 3` / `status: approved` until the user approves Revision 4.
- Decision source: user chose `system-and-mockups` (2026-11-03)

## Purpose
Shared visual foundation for the Food Store frontend (React + TS + Vite + Tailwind) and per-change mockups. Revision 4 adds a designed brand mark, self-hosted typography and a surface hierarchy; it is pending user approval.

## Revision history
- Revision 1: approved (2026-11-03, by user). Top navbar (`.topnav`).
- Revision 2: approved (2026-11-14, by user). The top navbar is replaced by a left sidebar for the whole app (KB DD-25, requested by the course coordinator). Desktop (>= 1024px): collapsible to icons only. Mobile: hidden behind a menu button, opens as a drawer over the content. Colors, type, spacing and every other component are unchanged.
- Revision 3: approved (2026-11-21, by user) (C-25b1). `components.html` sprite now holds all 49 icons of `frontend/src/shared/ui/icon` (32 were missing; same strokes, checked by `frontend/tests/architecture/sprite-iconos.test.tsx`) plus an icon gallery section; new provisional `assets/favicon.svg` derived from `assets/logo.svg`. No screen changes: the icons already render in the app, so no change mockup needs re-rendering. Approved by the user on 2026-11-21. No change mockup existed under Revision 1, so nothing needs re-rendering.
- Revision 4: pending (2026-11-23). Requested by the user: the app looked generic. Scope approved by the user: typography, surfaces, brand mark, badge discipline and motion rules. Not in scope: dark mode, new pages, product photos.
  - Typography: `--font-display` = Bricolage Grotesque (headings, prices), `--font-sans` = Geist (everything else). Both SIL OFL 1.1, self-hosted from `assets/fonts/` (latin subset, 106 KB total), declared with `@font-face` at the top of `tokens.css`. Source: `@fontsource-variable/bricolage-grotesque@5.3.0` and `@fontsource-variable/geist@5.3.0` (frontend dependencies). Prices and amounts use tabular numerals (`--numeric-tabular`).
  - Color: cream/beige neutrals replaced by an almost-white warm stone (`--color-bg` #FFF8EE -> #FAF8F5, `--color-surface-alt` #F7EEE0 -> #F3F0EB, `--color-border` #E3D5C0 -> #E6E1DA, `--color-text` #2B2118 -> #1F1A16, `--color-text-muted` #66584A -> #5F574F, `--color-primary-soft` #FDE8DB -> #F9ECE4, `--color-accent-soft` #E1F1E5 -> #EAF2EC); semantic and order-state backgrounds toned down. Terracotta `--color-primary` #B8400F is kept (5.56:1 with white text; recognisable, and already AA).
  - Surfaces: page / section / raised / overlay aliases; tinted layered shadows; radii 10/16 -> 8/12; when to use dividers instead of cards (see `components.html`, "Color y superficies").
  - Brand: new isotype (bowl with tomato and basil leaf on a terracotta tile) and wordmark (Bricolage Grotesque 700 outlined to paths, so it renders inside `<img>` without fonts). Replaces the "LOGO PROVISIONAL (TBD)" placeholder; `assets/favicon.svg` is the isotype alone and doubles as the compact mark for the collapsed sidebar.
  - Badges: order state is the only tinted chip (always with text); stock uses one neutral style with a colored dot; category, role and payment method are plain text; max one badge per card or table row.
  - Motion: `:active` scale `--press-scale` (0.97) on every pressable; hover only under `@media (hover:hover) and (pointer:fine)`; list stagger `--stagger-step` (40 ms, max 8 items) only on first mount; entries ease-out from `opacity:0; translateY(6px)`; `--ease-in-out` for sidebar collapse, `--ease-drawer` for the mobile drawer; reduced motion zeroes durations, press scale and stagger.
  - Affected mockups: every approved screen mockup changes appearance (fonts, background, borders, radii, logo). They are NOT re-rendered here; the apply change that brings Revision 4 into `frontend/src` re-renders and re-approves them (list below).

## Sources
- knowledge-base/README.md, 01, 02, 03, 06, 08, 13 (product, actors, stack)
- knowledge-base/05_reglas_de_negocio.md (order FSM: PENDIENTE, CONFIRMADO, EN_PREP, EN_CAMINO, ENTREGADO, CANCELADO)
- knowledge-base/09_decisiones_y_supuestos.md DD-25 (sidebar navigation and sections per role)
- Revisions 1-3: no existing logo/palette/typography found. Revision 4: design critique of the app requested by the user (2026-11-23) and the approved scope listed above.

## Files
- `brand.md` brand facts and tone; `brand.js` name constant bound to `[data-brand-name]`
- `tokens.css` `@font-face` for the two self-hosted fonts, then color, surface, type, spacing, radii, shadow, focus, motion and app-shell tokens (+ reduced motion). Since C-13a the frontend imports it as is and the Tailwind theme only references these variables (`frontend/tailwind.config.ts`, checked by a test)
- `assets/fonts/`: `bricolage-grotesque-latin-opsz-normal.woff2` (77 KB, axes opsz 12-96 + wght 200-800), `geist-latin-wght-normal.woff2` (29 KB, wght 100-900), `OFL-bricolage-grotesque.txt`, `OFL-geist.txt`
- `components.html` component and state reference; `assets/logo.svg` isotype + wordmark (Revision 4, approved 2026-11-23); `assets/favicon.svg` isotype alone (favicon and compact mark of the collapsed sidebar)
- Revision 4 previews: `previews/components-r4-desktop.png` (1440 wide, full page), `previews/components-r4-mobile.png` (390x844 viewport, full page), `previews/nav-r4-desktop-expanded.png`, `previews/nav-r4-desktop-collapsed.png` (1440x900), `previews/nav-r4-mobile-drawer.png` (390x844)
- Earlier previews kept for comparison: `components-r3-*.png` (Revision 3), `components-*.png` and `nav-*.png` (Revision 2)

## Sidebar navigation (Revision 2)
- Tokens: `--sidebar-width` (264px), `--sidebar-width-collapsed` (72px), `--topbar-height` (56px, mobile only), `--color-overlay`, `--z-topbar`, `--z-scrim`, `--z-drawer`. Breakpoint: 1024px.
- Markup reference: `.shell` > `.sidebar` (`.sidebar-head`, `.sidebar-nav`, `.sidebar-foot`) + `.shell-main` (`.topbar` on mobile, then the page).
- States: `.sidebar.is-collapsed` (desktop, icons only, label shown as tooltip; since Revision 4 the head shows the isotype `.sidebar-mark` instead of hiding the brand); `.shell.drawer-open` (mobile). In the app these map to `uiStore.sidebarCollapsed` (persisted) and `uiStore.sidebarOpen` (not persisted).
- Item states: normal, hover, keyboard focus, current page (`aria-current="page"`), with counter.
- Sections per role (`data-roles` in the markup): no session = Catálogo, Ingresar, Registrarse; CLIENT = Catálogo, Carrito, Mis pedidos, Direcciones, Mi cuenta; PEDIDOS = CLIENT + Gestión de pedidos; STOCK = CLIENT + group «Administración» with only Productos y stock; ADMIN = all + group «Administración» (Categorías, Ingredientes, Productos y stock, Usuarios, Dashboard).
- Transitions are enabled only after the first render (`.shell.is-ready`), so a saved collapsed state does not animate on load.
- Preview helpers in `components.html`: `?nav=collapsed`, `?nav=expanded`, `?nav=drawer`.

## Token names (Revision 4)
- Unchanged names, new values: `--color-primary-soft`, `--color-accent-soft`, `--color-bg`, `--color-surface-alt`, `--color-border`, `--color-text`, `--color-text-muted`, all `--color-*-bg` and `--state-*-bg`, `--font-sans`, `--font-display`, `--leading-tight` (1.2 -> 1.15), `--leading-normal` (1.5 -> 1.55), `--radius-md` (10 -> 8px), `--radius-lg` (16 -> 12px), `--shadow-sm|md|lg`, `--focus-ring` (offset uses the new bg; 3+2px -> 2+2px), `--color-overlay`.
- Added: `--color-border-strong`, `--surface-page`, `--surface-section`, `--surface-raised`, `--surface-overlay`, `--leading-snug`, `--weight-regular|medium|semibold|bold|display`, `--tracking-display`, `--tracking-caps`, `--numeric-tabular`, `--ease-in-out`, `--ease-drawer`, `--press-scale`, `--stagger-step`, `--z-page-header` (15, added 2026-11-23 with the page header; between page content and `--z-topbar`).
- Removed or renamed: none. The Tailwind theme keeps working; the new names are not yet mapped in `tailwind.config.ts` (part of the apply change).

## Usage rules (Revision 4)
- Surfaces: page (`--surface-page`) holds the view. Section (`--surface-section`, no shadow) groups without lifting: filters zone, totals, empty states. Raised (`--surface-raised`, 1px `--color-border`, `--shadow-sm`) only for an object the user acts on and that repeats independently (product card, address, the cart list). Overlay (`--shadow-lg`) for dialogs, drawer, toasts, menus. Never a card inside a card. Prefer a 1px divider or 32px of space over a box (catalog filters, order summary, account data, form groups).
- Borders: `--color-border` for decorative dividers and card edges; `--color-border-strong` for input and control outlines (3:1 non-text contrast).
- Type: headings and prices in `--font-display` weight `--weight-display` (650) with `--tracking-display`; body and UI in `--font-sans` 400, labels and nav 500, buttons and emphasis 600. Uppercase only for `xs` labels with `--tracking-caps`. Any price, amount, quantity or table number uses `font-variant-numeric: var(--numeric-tabular)`.
- Color: terracotta is the single brand tone (one primary action per view, current page, counters, brand mark). Basil green only means "available / fresh" or identifies the signed-in user (avatar); never decorative. Semantic colors only for status.
- Badges: order state = tinted chip with dot and text (the only tinted badge). Stock = one neutral chip with a colored dot, shown only for "Quedan N" (warning dot) or "Agotado" (danger dot). Counter = terracotta bubble. Category, role and payment method = plain muted text. At most one badge per card or table row.
- Motion: press `scale(var(--press-scale))` on every pressable, `--motion-fast` ease-out; hover only under `@media (hover:hover) and (pointer:fine)` and never changes size; list stagger `--stagger-step` (40 ms, max 8 items) only on first mount, never on pagination/filter/back; entries from `opacity:0; translateY(6px)`, never from `scale(0)`; `--ease-in-out` for the sidebar collapse, `--ease-drawer` for the mobile drawer; keyboard actions are not animated; transition named properties only (never `all`). Reduced motion sets durations, press scale and stagger to neutral values.

## Page header (Revision 4 component addition, 2026-11-23)
Requested by the user after the first Revision 4 mockups: the sidebar and the mobile top bar stay, but titles and filters lacked presence. This is a component addition: no token value changed; one token was added (`--z-page-header`). Reference: section «Encabezado de página» in `components.html` (normal and compact specimens). Change decision: `openspec/changes/revision-visual/design.md` D9.
- Markup: `.page-band` > `.band-inner` > `.band-crumbs` (optional back/breadcrumb), `.band-top` (`.band-titles`: `.eyebrow`, `.band-h` with `h1` + optional status badge, `.band-sub`; `.band-actions`: meta + primary action), `.band-toolbar` (search, filters, sort, period), `.band-active` (`.band-count` + removable `.tag` chips + «Limpiar filtros»). Page content follows in `.page-body`.
- Sticky: `.page-band.is-sticky` = `position: sticky; top: 0; z-index: var(--z-page-header)` on `--surface-page`, used by list pages (catalog, my orders, order management, categories, ingredients, products and stock, users, addresses, dashboard) and by detail pages only when the band holds actions. Only the list scrolls below it. Table headers stick right below the band (`top: var(--band-h)`, the table container uses `overflow: clip`).
- Compact state: `.is-stuck` (set by a sentinel/IntersectionObserver in the app) shrinks the title one step (2.75rem -> `--text-2xl`), collapses subtitle and eyebrow and adds a hairline + `--shadow-sm`; transitions use `--motion-*` and are neutral under reduced motion.
- Mobile (< 1024px): sticky at `top: var(--topbar-height)` below the existing top bar; title `--text-2xl`/`--text-xl`, «Filtros» button with count opening the bottom sheet, chip rows scroll horizontally; at most about 25% of an 844px screen.
- Not used on centered state screens (404, error, forbidden, session loading, sign in/up, order created).

## Contrast (WCAG 2.1, Revision 4)
| Pair | Ratio |
|---|---|
| white on `--color-primary` #B8400F | 5.56:1 |
| white on `--color-primary-hover` #9A3409 | 7.32:1 |
| `--color-primary` on bg #FAF8F5 | 5.24:1 |
| `--color-primary-hover` on `--color-primary-soft` #F9ECE4 | 6.32:1 |
| `--color-text` #1F1A16 on bg / surface / surface-alt | 16.3 / 17.3 / 15.2:1 |
| `--color-text-muted` #5F574F on bg / surface / surface-alt | 6.7 / 7.1 / 6.2:1 |
| `--color-accent` #2F6B3F on surface (and white on accent) | 6.37:1 |
| accent on `--color-accent-soft` #EAF2EC | 5.59:1 |
| `--color-border-strong` #8E847B vs surface / bg (non-text) | 3.66 / 3.45:1 |
| order state fg on its bg: pendiente, confirmado, en prep, en camino, entregado, cancelado | 5.32, 6.09, 7.17, 7.07, 5.66, 5.58:1 |
| focus ring #1D5B8F vs bg | 6.73:1 |

Note: Revision 3 documented white on primary as 5.9:1; the measured value is 5.56:1 (still AA).

## Mockups affected by Revision 4
Every approved screen mockup changes appearance (font, background, borders, radii, shadows, logo in the chrome). They are not re-rendered in this revision; the apply change that brings Revision 4 into `frontend/src` re-renders them and asks for renewed approval: C-13a (shell, 404, session loading), C-13b (auth/session), C-14 (auth and account), C-15 (addresses), C-16b and fe-catalogo-filtros-arriba (catalog, product detail), C-17a (admin categories and ingredients), C-17b (admin products and stock), C-18 (cart), C-19 (checkout), C-20a (card payment), C-20b (payment follow-up), C-21 (my orders), C-22 (order management), C-23 (admin users and roles), C-24 (dashboard), C-25b1 (inherited debt). Paths: `openspec/changes/archive/*/mockups/`.

## Open decisions (TBD)
- Revision 4 approval: isotype, wordmark, fonts and palette are pending the user's approval. Until then `assets/logo.svg` and `assets/favicon.svg` are not final (their `<title>`/comment say so).
- Product photography style (Cloudinary images): later change.
- Dark mode: declined for now (2026-11-23).
- Copy details: delivery time estimate, cash/transfer payment options (KB PA-06).
- Role COCINA / KDS screens not specified by spec (KB PA-07, PA-19); no components or sidebar section defined for them.

## Replacement steps
1. Name: edit `BRAND_NAME` in `brand.js` AND the constant in `frontend/src/shared/config/brand.ts` (the app keeps its own copy since C-13a). The wordmark in `assets/logo.svg` is outlined paths: regenerate it from Bricolage Grotesque 700 (opsz 36, tracking -1%) if the name changes.
2. Logo: replace `assets/logo.svg` (viewBox 224x64, mark scaled into 0..48) and `assets/favicon.svg` (viewBox 64x64) keeping both paths. `frontend/tests/architecture/sprite-iconos.test.tsx` expects the favicon to contain `#B8400F` and the word `PROVISIONAL`; update that test once the logo is approved.
3. Fonts: replace the woff2 files in `assets/fonts/` and the two `@font-face` rules at the top of `tokens.css`; keep the OFL license files next to them. No remote font URLs.
4. Colors/type/spacing: edit values in `tokens.css` only; bump `Revision:` and reset Approval to pending.
5. Re-render `components.html` at 390x844 and 1440x900 into `previews/`.

## Preview note
Revision 4 captures were taken with `playwright-core` driving the installed Microsoft Edge (headless, no browser download) straight from the local file, with real viewport emulation: the mobile capture is a true 390x844 mobile viewport (not an iframe); `scrollWidth` was 390 (no horizontal overflow) and both fonts were reported loaded. The full-page desktop capture stretches the sticky sidebar to the page height; the 1440x900 `nav-r4-*` captures show real proportions. Revisions 1-3 used headless Edge with a 390px iframe because the window cannot go below about 500px.
