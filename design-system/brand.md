# Brand - Food Store (Revision 4, approved 2026-11-23)

| Aspect | Value | Source |
|---|---|---|
| Product name | Food Store (rendered via `brand.js`) | knowledge-base/README.md; confirmed by the user on 2026-11-23 ("the product name stays Food Store") |
| Product | E-commerce de venta de comida; clientes compran, roles internos gestionan | KB 01, 02 |
| Tone | Cercano, claro y apetitoso; voz en español rioplatense, frases cortas, sin jerga técnica en UI de cliente. Panel interno: sobrio y denso. | Design decision (Revision 1, approved) |
| Logo | `assets/logo.svg`: isotype + wordmark. Isotype: a bowl with a tomato and a basil leaf, white on a terracotta (#B8400F) rounded tile, built on a 64px grid with simple geometry so it holds at 16px. Wordmark: "Food Store" in Bricolage Grotesque 700, outlined to paths (renders inside `<img>` without loading fonts), color `--color-text`. | Designed in Revision 4 (2026-11-23). **Pending user approval**: not final until `README.md` says `Approval: approved`. |
| Compact mark / favicon | `assets/favicon.svg`: the isotype alone. Used as favicon and as the brand mark of the collapsed sidebar. | Revision 4, approved 2026-11-23 |
| Logo usage | Minimum size: isotype 16px, full logo 28px high. Clear space: half the isotype height on every side. Only on `--color-bg` or `--color-surface`; never recolor, stretch, add shadows or place on photos. | Revision 4 |
| Imagery | Product photos come from Cloudinary (KB 02); style (TBD, later change). Placeholders use `--surface-section` with the `plato` icon, never fake photos. | KB 02 |
| Palette | Terracotta primary (single brand tone), basil green only for "available" and the user avatar, warm-stone near-white neutrals | Revision 4 (Revisions 1-3 used a warm cream background) |
| Typography | Bricolage Grotesque (headings, prices) + Geist (UI and body). Both SIL OFL 1.1, self-hosted in `assets/fonts/`, no remote fonts. | Revision 4; source packages `@fontsource-variable/bricolage-grotesque@5.3.0`, `@fontsource-variable/geist@5.3.0` |

Usage rules: use tokens from `tokens.css` only; never hardcode colors. Primary is for the single main action per view. Order state colors always pair with a text label (never color alone). Font license note: the OFL allows using the fonts in a logo; the outlined wordmark is artwork, not a redistributed font.
