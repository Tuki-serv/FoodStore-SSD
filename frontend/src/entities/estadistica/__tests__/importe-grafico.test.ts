import { describe, expect, it } from 'vitest';
import { aNumero, formatearCantidad, importeCorto, porcentajes } from '../model/importe-grafico';

describe('aNumero', () => {
  it('convierte un decimal en texto al número del eje', () => {
    expect(aNumero('1500.50')).toBe(1500.5);
    expect(aNumero('0.00')).toBe(0);
  });

  it('un valor que no es decimal es 0', () => {
    expect(aNumero('abc')).toBe(0);
  });
});

describe('importeCorto', () => {
  it('abrevia miles y millones para el eje', () => {
    expect(importeCorto(0)).toBe('$ 0');
    expect(importeCorto(500)).toBe('$ 500');
    expect(importeCorto(20000)).toBe('$ 20 mil');
    expect(importeCorto(1200000)).toBe('$ 1,2 M');
  });
});

describe('porcentajes', () => {
  it('reparte 1500 y 500 en 75 y 25', () => {
    expect(porcentajes(['1500.00', '500.00'])).toEqual([75, 25]);
  });

  it('con redondeos la suma sigue siendo 100 (tres tercios)', () => {
    const resultado = porcentajes(['100.00', '100.00', '100.00']);
    expect(resultado.reduce((a, b) => a + b, 0)).toBe(100);
    expect([...resultado].sort()).toEqual([33, 33, 34]);
  });

  it('el resto mayor se lo lleva quien más se acerca al siguiente entero', () => {
    expect(porcentajes(['305250.00', '272800.00', '71450.00'])).toEqual([47, 42, 11]);
  });

  it('todo en cero da ceros', () => {
    expect(porcentajes(['0.00', '0.00'])).toEqual([0, 0]);
  });

  it('una lista vacía da una lista vacía', () => {
    expect(porcentajes([])).toEqual([]);
  });
});

describe('formatearCantidad', () => {
  it('separa los miles con punto, como los precios', () => {
    expect(formatearCantidad(3)).toBe('3');
    expect(formatearCantidad(1234)).toBe('1.234');
    expect(formatearCantidad(1234567)).toBe('1.234.567');
  });
});
