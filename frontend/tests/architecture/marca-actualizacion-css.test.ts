// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const raiz = postcss.parse(readFileSync(resolve(process.cwd(), 'src/shared/ui/marca-actualizacion/marca-actualizacion.css'), 'utf8'));

function enMobile(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  raiz.walkAtRules('media', (media) => {
    if (!media.params.includes('max-width:1023.98px') && !media.params.includes('max-width: 1023.98px')) return;
    media.walkRules((regla) => {
      if (regla.selectors.map((s) => s.trim()).includes(selector)) regla.walkDecls((d) => { out[d.prop] = d.value; });
    });
  });
  return out;
}

describe('marca-actualizacion.css — mobile según el mockup de gestión de pedidos', () => {
  it('oculta la hora bajo 1024 px', () => {
    expect(enMobile('.refresh .when')['display']).toBe('none');
  });

  it('deja el botón solo con ícono bajo 1024 px, con el texto visualmente oculto (sigue siendo su nombre accesible)', () => {
    const etiqueta = enMobile('.refresh .lbl-m');
    expect(etiqueta['position']).toBe('absolute');
    expect(etiqueta['width']).toBe('1px');
    expect(etiqueta['clip']).toBe('rect(0 0 0 0)');
  });
});
