// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

// Medidas del mockup aprobado `mockups/gestion-pedidos.html` (pages.css: th, `.order-n`, `.seg`, `.table-panel`).
const REGLAS = reglasDeSrc();

function decl(selector: string): Record<string, string> {
  const fusion: Record<string, string> = {};
  for (const regla of REGLAS) if (regla.selector.replace(/\s+/g, ' ') === selector) Object.assign(fusion, regla.declaraciones);
  return fusion;
}

/** Primera regla del selector (la de escritorio; los media la ajustan después). */
function primera(selector: string): Record<string, string> {
  return REGLAS.find((regla) => regla.selector.replace(/\s+/g, ' ') === selector)?.declaraciones ?? {};
}

describe('gestion-pedidos.css — lista según el mockup aprobado', () => {
  it('la grilla tiene seis columnas y la fila es compacta (56 px)', () => {
    const fila = primera('.orow');

    expect(fila['grid-template-columns']?.split(/\s+(?![^(]*\))/).length).toBe(6);
    expect(fila['min-height']).toBe('56px');
  });

  it('el encabezado de columnas es texto simple: sin mayúsculas, sin negrita y apagado', () => {
    const d = decl('.orow.ohead');

    expect(d['text-transform']).toBeUndefined();
    expect(d['letter-spacing']).toBeUndefined();
    expect(d['font-weight']).toBe('var(--weight-medium)');
    expect(d['color']).toBe('var(--color-text-muted)');
  });

  it('el número de pedido es texto normal (no naranja) y la fila no usa negritas pesadas', () => {
    const numero = decl('.onum a');

    expect(numero['color']).toBe('var(--color-text)');
    expect(numero['font-weight']).toBe('var(--weight-semibold)');
    expect(decl('.ocli')['font-weight']).toBeUndefined();
    expect(decl('.ototal')['font-weight']).toBe('var(--weight-regular)');
    expect(decl('.opay')['color']).toBe('var(--color-text-muted)');
  });

  it('el control segmentado es un grupo con borde fino y la opción marcada sobre --surface-section', () => {
    expect(decl('.gp-seg')['border']).toBe('1px solid var(--color-border)');
    expect(decl('.gp-seg button[aria-pressed=true]')['background']).toBe('var(--surface-section)');
  });

  it('los filtros del encabezado no llevan etiquetas en mayúsculas', () => {
    expect(decl('.gp-filters .field label')['text-transform']).toBeUndefined();
  });
});
