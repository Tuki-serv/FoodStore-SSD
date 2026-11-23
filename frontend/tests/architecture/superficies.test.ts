// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

const REGLAS = reglasDeSrc();

/** Declaraciones de un selector exacto, fusionando sus reglas en orden (los media solo ajustan). */
function declaraciones(selector: string): Record<string, string> {
  const fusion: Record<string, string> = {};
  for (const regla of REGLAS) if (regla.selector.replace(/\s+/g, ' ') === selector) Object.assign(fusion, regla.declaraciones);
  return fusion;
}

const sinCaja = (valor: string | undefined): boolean => valor === undefined || valor === 'none' || valor === '0';

/** D2: raised = objeto sobre el que se actúa (borde 1 px + shadow-sm). */
const RAISED = ['.addr', '.pcard', '.form-card', '.olist', '.plist', '.ilist', '.ctree > li', '.kpi', '.auth-card', '.cartitem'];
/** D2: section = zona agrupada (sin borde ni sombra). */
const SECTION = ['.summary', '.gp-filters', '.periodo', '.bloque', '.pcard-in', '.ro-list', '.ihead', '.orow.ohead', '.prow.phead', '.uhead', '.dtabla thead th', '.sub-row', '.custom', '.pirow'];
/** D2: por encima de todo (diálogo, menú): --surface-overlay con shadow-lg. */
const OVERLAY = ['.modal', '.popover'];
/** D2: el resto se separa con divisores y espaciado, sin caja. */
const SIN_CAJA = ['.step', '.ocard', '.ing-list li'];

describe('superficies por rol (design D2)', () => {
  it.each(RAISED)('%s es raised: --surface-raised, borde 1 px y shadow-sm', (selector) => {
    const d = declaraciones(selector);

    expect(d['background']).toBe('var(--surface-raised)');
    expect(d['border']).toMatch(/^1px solid /);
    expect(d['box-shadow']).toBe('var(--shadow-sm)');
  });

  it.each(SECTION)('%s es section: --surface-section sin borde ni sombra', (selector) => {
    const d = declaraciones(selector);

    expect(d['background']).toBe('var(--surface-section)');
    expect(sinCaja(d['border']), `${selector} border`).toBe(true);
    expect(sinCaja(d['box-shadow']), `${selector} box-shadow`).toBe(true);
  });

  it.each(OVERLAY)('%s es overlay: --surface-overlay y shadow-lg', (selector) => {
    const d = declaraciones(selector);

    expect(d['background']).toBe('var(--surface-overlay)');
    expect(d['box-shadow']).toBe('var(--shadow-lg)');
  });

  it.each(SIN_CAJA)('%s no es una caja: sin fondo, borde completo ni sombra, separada por divisor', (selector) => {
    const d = declaraciones(selector);

    expect(d['background'], 'background').toBeUndefined();
    expect(sinCaja(d['border']), 'border').toBe(true);
    expect(sinCaja(d['box-shadow']), 'box-shadow').toBe(true);
    expect(d['border-bottom'], 'divisor').toMatch(/^1px solid var\(--color-border\)/);
  });
});
