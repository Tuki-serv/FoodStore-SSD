# Food Store - Design System

- Mode: system-and-mockups
- Revision: 1
- Approval: approved (2026-11-03, by user)
- Decision source: user chose `system-and-mockups` (2026-11-03)

## Purpose
Shared visual foundation for the Food Store frontend (React + TS + Vite + Tailwind) and per-change mockups. Provisional: no prior brand existed.

## Sources
- knowledge-base/README.md, 01, 02, 03, 06, 08, 13 (product, actors, stack)
- knowledge-base/05_reglas_de_negocio.md (order FSM: PENDIENTE, CONFIRMADO, EN_PREP, EN_CAMINO, ENTREGADO, CANCELADO)
- No existing logo/palette/typography found.

## Files
- `brand.md` brand facts and tone; `brand.js` name constant bound to `[data-brand-name]`
- `tokens.css` color, type, spacing, radii, shadow, focus, motion tokens (+ reduced motion)
- `components.html` component and state reference; `assets/logo.svg` provisional logo
- `previews/components-mobile.png` (390 wide), `previews/components-desktop.png` (1440 wide)

## Open decisions (TBD)
- Final product name and logo (placeholder is labeled "LOGO PROVISIONAL (TBD)")
- Product photography style (Cloudinary images)
- Final palette approval (terracotta primary, basil green accent, warm cream background)
- Whether to map tokens into Tailwind theme (proposed: yes, in the frontend setup change)
- Copy details: delivery time estimate, cash/transfer payment options (KB PA-06)
- Role COCINA / KDS screens not specified by spec (KB PA-07, PA-19); no components defined for them

## Replacement steps
1. Name: edit `BRAND_NAME` in `brand.js`.
2. Logo: replace `assets/logo.svg` keeping the path; remove the "LOGO PROVISIONAL" text.
3. Colors/type/spacing: edit values in `tokens.css` only; bump `Revision:` and reset Approval to pending.
4. Re-render `components.html` at 390x844 and 1440x900 into `previews/`.

## Preview note
Playwright MCP could not launch (Chrome not installed). Captures were taken with headless Microsoft Edge from a local static server (since stopped); the mobile capture was rendered in a 390px iframe and verified to have no horizontal overflow.
