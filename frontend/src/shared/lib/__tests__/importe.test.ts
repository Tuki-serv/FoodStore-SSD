import { describe, expect, it } from 'vitest';
import { aCentavos, formatearCentavos, sumarImportes } from '../importe';

describe('aCentavos', () => {
  it.each([
    ['1250.50', 125050],
    ['3800', 380000],
    ['0.1', 10],
    ['0.05', 5],
  ])('%s → %i centavos', (decimal, centavos) => {
    expect(aCentavos(decimal)).toBe(centavos);
  });

  it.each(['', 'abc', '-1.00', '1.234', '1,50'])('«%s» no es un importe válido', (decimal) => {
    expect(aCentavos(decimal)).toBeNull();
  });
});

describe('formatearCentavos', () => {
  it.each([
    [385000, '3850.00'],
    [5, '0.05'],
    [125050, '1250.50'],
  ])('%i centavos → %s', (centavos, decimal) => {
    expect(formatearCentavos(centavos)).toBe(decimal);
  });
});

describe('sumarImportes', () => {
  it('suma en centavos sin errores de coma flotante', () => {
    expect(sumarImportes('0.10', '0.20')).toBe('0.30');
    expect(sumarImportes('3800.00', '50.00')).toBe('3850.00');
  });

  it('un importe inválido cuenta como cero', () => {
    expect(sumarImportes('10.00', 'x')).toBe('10.00');
  });
});
