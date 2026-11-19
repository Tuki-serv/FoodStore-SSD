import { describe, expect, it } from 'vitest';
import { montoDesdeTotal } from '../model/monto-desde-total';

describe('montoDesdeTotal', () => {
  it.each([
    ['2850.00', 2850],
    ['1300.50', 1300.5],
    ['0.10', 0.1],
    ['19.99', 19.99],
  ])('%s -> %s', (total, esperado) => {
    expect(montoDesdeTotal(total)).toBe(esperado);
  });
});
