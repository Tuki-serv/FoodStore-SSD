// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(resolve(process.cwd(), 'src/shared/ui/encabezado-pagina/encabezado-pagina.css'), 'utf8');
const raiz = postcss.parse(CSS);

interface ReglaConMedia {
  selector: string;
  media: string;
  decl: Record<string, string>;
}

function reglas(): ReglaConMedia[] {
  const lista: ReglaConMedia[] = [];
  raiz.walkRules((regla) => {
    const decl: Record<string, string> = {};
    regla.each((nodo) => {
      if (nodo.type === 'decl') decl[nodo.prop] = nodo.value;
    });
    const padre = regla.parent;
    const media = padre?.type === 'atrule' && (padre as postcss.AtRule).name === 'media' ? (padre as postcss.AtRule).params : '';
    for (const selector of regla.selectors) lista.push({ selector: selector.trim(), media, decl });
  });
  return lista;
}

describe('encabezado-pagina.css (D9)', () => {
  it('solo la banda fija (.is-sticky) usa position: sticky arriba del área de contenido, con el token --z-page-header', () => {
    const sticky = reglas().filter((r) => r.decl['position'] === 'sticky' && r.selector.includes('page-band'));

    expect(sticky.map((r) => r.selector)).toEqual(['.page-band.is-sticky']);
    expect(sticky[0]?.decl['z-index']).toBe('var(--z-page-header)');
    expect(sticky[0]?.decl['top']).toBe('0');
  });

  it('la grilla de la banda no se ensancha por el contenido de la barra (sin desborde horizontal a 390 px)', () => {
    const inner = reglas().find((r) => r.selector === '.band-inner' && r.media === '');

    expect(inner?.decl['grid-template-columns']).toBe('minmax(0, 1fr)');
  });

  it('bajo 1024 px la banda fija queda debajo de la barra superior', () => {
    const mobile = reglas().find((r) => r.selector === '.page-band.is-sticky' && r.media.includes('max-width'));

    expect(mobile?.decl['top']).toBe('var(--topbar-height)');
  });

  it('el estado compacto baja el título de escala, oculta el subtítulo y agrega filete y sombra', () => {
    const todas = reglas();
    const titulo = todas.find((r) => r.selector === '.page-band[data-stuck="true"] .band-h h1' && r.media === '');
    const sub = todas.find((r) => r.selector === '.page-band[data-stuck="true"] .band-sub');
    const banda = todas.find((r) => r.selector === '.page-band[data-stuck="true"]');

    expect(titulo?.decl['font-size']).toBe('var(--text-2xl)');
    expect(sub?.decl['opacity']).toBe('0');
    expect(banda?.decl['border-bottom-color']).toBe('var(--color-border)');
    expect(banda?.decl['box-shadow']).toBeDefined();
  });

  it('con movimiento reducido el cambio de tamaño y visibilidad no tiene transición', () => {
    const selectores: string[] = [];
    raiz.walkAtRules('media', (media) => {
      if (!/prefers-reduced-motion:\s*reduce/.test(media.params)) return;
      media.walkRules((regla) => {
        regla.walkDecls('transition', (d) => {
          if (d.value === 'none') selectores.push(regla.selector);
        });
      });
    });

    const texto = selectores.join(',');
    expect(texto).toContain('.page-band');
    expect(texto).toContain('.band-inner');
    expect(texto).toContain('h1');
    expect(texto).toContain('.band-sub');
  });

  it('en mobile compacto, las herramientas de una banda con herramientasColapsables se ocultan', () => {
    const regla = reglas().find((r) => r.selector === '.page-band[data-stuck="true"].band-tools-collapse .band-toolbar');

    expect(regla?.media).toContain('max-width');
    expect(regla?.decl['display']).toBe('none');
  });

  it('los encabezados de tabla fijos usan la variable --band-h publicada por el componente', () => {
    const th = reglas().find((r) => r.selector === '.th-fijos thead th');

    expect(th?.decl['position']).toBe('sticky');
    expect(th?.decl['top']).toBe('var(--band-h, 0px)');
  });
});
