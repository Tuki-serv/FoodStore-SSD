// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

// Medidas del mockup aprobado `mockups/producto-detalle.html` + `producto-personalizar.html` (pages.css: `.pd-*`, `.ing-list`, `.note`).
const REGLAS = reglasDeSrc();

/** Declaraciones de un selector exacto, fusionando sus reglas en orden. */
function decl(selector: string): Record<string, string> {
  const fusion: Record<string, string> = {};
  for (const regla of REGLAS) if (regla.selector.replace(/\s+/g, ' ') === selector) Object.assign(fusion, regla.declaraciones);
  return fusion;
}

/** Primera regla del selector (la de escritorio; los media la ajustan después). */
function primera(selector: string): Record<string, string> {
  return REGLAS.find((regla) => regla.selector.replace(/\s+/g, ' ') === selector)?.declaraciones ?? {};
}

const sinCaja = (d: Record<string, string>): boolean => ['background', 'border', 'box-shadow'].every((p) => d[p] === undefined || ['none', '0', 'transparent'].includes(d[p] as string));

describe('producto.css — detalle según el mockup aprobado', () => {
  it('la categoría es texto chico y apagado, no una píldora en mayúsculas', () => {
    const d = decl('.tagline');

    expect(d['text-transform']).toBeUndefined();
    expect(d['background']).toBeUndefined();
    expect(d['border-radius']).toBeUndefined();
    expect(d['color']).toBe('var(--color-text-muted)');
  });

  it('la fila de compra no es una caja (sin fondo, borde ni sombra)', () => {
    expect(sinCaja(decl('.pd-buy'))).toBe(true);
    expect(decl('.pd-buy')['padding']).toBeUndefined();
  });

  it('alérgenos e ingredientes son bloques separados por un divisor superior', () => {
    expect(decl('.pd-section')['border-top']).toBe('1px solid var(--color-border)');
  });

  it('el bloque de alérgenos no es una alerta amarilla: solo el ícono lleva el color de advertencia', () => {
    const d = decl('.pd-note');

    expect(d['background']).toBeUndefined();
    expect(d['border-radius']).toBeUndefined();
    expect(decl('.pd-note .ico')['color']).toBe('var(--color-warning)');
  });

  it('los ingredientes van en dos columnas con divisores entre filas, sin píldoras', () => {
    const fila = decl('.ing-list li');

    expect(primera('.ing-list')['columns']).toBe('2');
    expect(fila['border-bottom']).toBe('1px solid var(--color-border)');
    expect(fila['background']).toBeUndefined();
    expect(fila['border-radius']).toBeUndefined();
  });

  it('el «$» del precio es chico y apagado', () => {
    const d = decl('.pd-price .price small');

    expect(d['font-size']).toBe('.6em');
    expect(d['color']).toBe('var(--color-text-muted)');
  });

  it('en «Personalizá tu pedido» las opciones son filas planas, sin caja ni fondo de seleccionada', () => {
    const opt = decl('.custom .opt');
    const marcada = decl('.custom .opt.is-checked');

    expect(opt['border']).toBe('0');
    expect(opt['background']).toBe('transparent');
    expect(marcada['background']).toBe('transparent');
  });
});
