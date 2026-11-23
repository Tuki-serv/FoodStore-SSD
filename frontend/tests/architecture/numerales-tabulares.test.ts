// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

const REGLAS = reglasDeSrc();
const TOKEN = 'var(--numeric-tabular)';

const tabular = (selector: string): boolean =>
  REGLAS.some((regla) => regla.selector.replace(/\s+/g, ' ') === selector && regla.declaraciones['font-variant-numeric'] === TOKEN);

describe('numerales tabulares (spec frontend-visual-language, «Importes alineados»)', () => {
  it.each([
    // precios (tarjeta, carrito, listado admin)
    '.price',
    '.pprice',
    '.cartitem .unit',
    // cantidades
    '.qty output',
    // totales y resúmenes (carrito, checkout, pago, pedido creado, pedidos)
    '.summary .line',
    '.summary .total',
    '.sum-items .q',
    '.sum-items li>:last-child',
    '.totals .line',
    '.totals .total',
    '.ototal',
    // dashboard
    '.kpi-val',
    '.dona-centro strong',
    '.leyenda .pct',
    '.dtabla',
  ])('%s usa font-variant-numeric con el token --numeric-tabular', (selector) => {
    expect(tabular(selector), selector).toBe(true);
  });

  it('ningún CSS del frontend escribe tabular-nums como literal: todo sale del token', () => {
    const literales = REGLAS.filter((regla) => /tabular-nums/.test(regla.declaraciones['font-variant-numeric'] ?? '')).map((regla) => regla.selector);

    expect(literales).toEqual([]);
  });
});
