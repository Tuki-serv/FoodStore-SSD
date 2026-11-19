import { describe, expect, it } from 'vitest';
import { COSTO_ENVIO, DESCUENTO, totalEstimado } from '../model';

describe('constantes de DD-10', () => {
  it('el envío fijo es 50.00 y el descuento 0.00', () => {
    expect(COSTO_ENVIO).toBe('50.00');
    expect(DESCUENTO).toBe('0.00');
  });
});

describe('totalEstimado', () => {
  it.each([
    ['3800.00', '3850.00'],
    ['0.10', '50.10'],
    ['1250.50', '1300.50'],
  ])('subtotal %s → total %s', (subtotal, total) => {
    expect(totalEstimado(subtotal)).toBe(total);
  });
});
