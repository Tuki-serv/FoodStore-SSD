// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claseBoton } from '../../src/shared/ui/button/button-styles';
import { reglasDeSrc, type ReglaPlana } from './css-src';

const RAIZ = process.cwd();
const TOKENS_CSS = resolve(RAIZ, '../design-system/tokens.css');

const REGLAS = reglasDeSrc();
const reglasDe = (selector: string): ReglaPlana[] => REGLAS.filter((regla) => regla.selector === selector);

describe('respuesta al presionar (spec frontend-visual-language)', () => {
  it('claseBoton escala con el token de presión y los tokens de movimiento, no con un literal', () => {
    for (const variante of ['primario', 'secundario', 'fantasma', 'peligro'] as const) {
      const clases = claseBoton(variante).split(' ');
      expect(clases, variante).toContain('active:scale-press');
      expect(clases, variante).toContain('duration-fast');
      expect(clases, variante).toContain('ease-out');
      expect(clases.filter((c) => /^active:scale-\[/.test(c)), variante).toEqual([]);
    }
  });

  it('el botón deshabilitado no escala al presionarse', () => {
    expect(claseBoton('primario').split(' ')).toContain('disabled:active:scale-100');
  });

  it.each(['.prod', '.kpi-link', '.link-btn', '.icon-btn'])('%s tiene una regla :active con scale(var(--press-scale)) y transición de transform con tokens', (base) => {
    const activas = REGLAS.filter((r) => r.selector.startsWith(`${base}:active`) || r.selector === `${base}:active`);
    const transiciones = reglasDe(base).map((r) => r.declaraciones['transition'] ?? '');

    expect(activas.length, `${base}:active`).toBeGreaterThan(0);
    expect(activas.some((r) => /scale\(var\(--press-scale\)\)/.test(r.declaraciones['transform'] ?? ''))).toBe(true);
    expect(transiciones.some((t) => /transform var\(--motion-fast\) var\(--ease-out\)/.test(t)), `transition de ${base}`).toBe(true);
  });

  it('ninguna regla :active del frontend escala con un literal', () => {
    const conLiteral = REGLAS.filter((r) => r.selector.includes(':active') && /scale\((?!var\(--press-scale\))/.test(r.declaraciones['transform'] ?? ''));

    expect(conLiteral.map((r) => r.selector)).toEqual([]);
  });

  it('con movimiento reducido el token de presión vale 1 (sin escala) y las duraciones, 0', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const bloque = /@media \(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';

    expect(bloque).toMatch(/--press-scale:\s*1\b/);
    expect(bloque).toMatch(/--motion-fast:\s*0ms/);
  });
});
