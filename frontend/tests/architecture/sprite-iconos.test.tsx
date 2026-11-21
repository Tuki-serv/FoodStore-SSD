// @vitest-environment node
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES, Icon } from '@/shared/ui/icon/icon';

const HTML = readFileSync(new URL('../../../design-system/components.html', import.meta.url), 'utf8');
const SIMBOLOS = new Map([...HTML.matchAll(/<symbol id="i-([a-z]+)" viewBox="0 0 24 24">(.*?)<\/symbol>/g)].map((m) => [m[1] ?? '', m[2] ?? '']));

/** Trazos de un ícono tal como los pinta la app, sin el `<svg>` envolvente y con las etiquetas autocerradas normalizadas. */
function trazosDeLaApp(nombre: (typeof ICON_NAMES)[number]): string {
  const svg = renderToStaticMarkup(<Icon name={nombre} />);
  return normalizar(svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''));
}

const normalizar = (marcado: string): string => marcado.replace(/<(\w+)([^>]*?)\s*\/>/g, '<$1$2></$1>');

describe('sprite de design-system/components.html (Revision 3)', () => {
  it('tiene un símbolo por cada ícono de shared/ui/icon y ninguno de más', () => {
    const faltantes = ICON_NAMES.filter((nombre) => !SIMBOLOS.has(nombre));
    const sobrantes = [...SIMBOLOS.keys()].filter((id) => !(ICON_NAMES as readonly string[]).includes(id));

    expect({ faltantes, sobrantes }).toEqual({ faltantes: [], sobrantes: [] });
  });

  it.each(ICON_NAMES)('el símbolo «%s» tiene los mismos trazos que el componente', (nombre) => {
    expect(normalizar(SIMBOLOS.get(nombre) ?? '')).toBe(trazosDeLaApp(nombre));
  });
});

describe('favicon provisional', () => {
  const favicon = readFileSync(new URL('../../../design-system/assets/favicon.svg', import.meta.url), 'utf8');

  it('es un SVG derivado del logo y está marcado como provisional', () => {
    expect(favicon).toContain('<svg');
    expect(favicon).toMatch(/PROVISIONAL/);
    expect(favicon).toContain('#B8400F');
  });
});
