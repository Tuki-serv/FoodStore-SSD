// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

// Medidas del mockup aprobado `mockups/catalogo.html` (pages.css: `.band-toolbar .search` y `.chip`).
const raiz = postcss.parse(readFileSync(resolve(process.cwd(), 'src/pages/catalogo/ui/catalogo.css'), 'utf8'));

function decl(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  raiz.walkRules((regla) => {
    if (!regla.selectors.map((s) => s.trim()).includes(selector) || regla.parent?.type !== 'atrule' || (regla.parent as postcss.AtRule).name !== 'layer') return;
    regla.walkDecls((d) => { out[d.prop] = d.value; });
  });
  return out;
}

describe('catalogo.css — barra del encabezado según el mockup aprobado', () => {
  it('el buscador de escritorio no crece más allá de 280 px, así las categorías entran en una línea', () => {
    expect(decl('.band-toolbar .search')['flex']).toBe('0 1 280px');
  });

  it('las píldoras de categoría tienen la medida del chip del mockup (36 px, borde fino, peso medio)', () => {
    const pill = decl('.pill');

    expect(pill['min-height']).toBe('36px');
    expect(pill['padding']).toBe('0 var(--space-3)');
    expect(pill['border']).toBe('1px solid var(--color-border)');
    expect(pill['font-weight']).toBe('var(--weight-medium)');
  });
});
