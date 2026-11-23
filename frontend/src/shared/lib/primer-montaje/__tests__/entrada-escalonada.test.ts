import { describe, expect, it } from 'vitest';
import { CLASE_ENTRADA_ESCALONADA, claseEntradaEscalonada, estiloEscalonado, TOPE_ESCALONADO } from '../entrada-escalonada';

describe('estiloEscalonado', () => {
  it.each([
    [0, '0'],
    [3, '3'],
    [8, '8'],
    [9, '8'],
    [40, '8'],
  ])('el elemento %i lleva --i = %s (topado en 8)', (indice, esperado) => {
    expect((estiloEscalonado(indice) as Record<string, string>)['--i']).toBe(esperado);
  });

  it('el tope es 8, como el del design system', () => {
    expect(TOPE_ESCALONADO).toBe(8);
  });
});

describe('claseEntradaEscalonada', () => {
  it('agrega la clase de entrada solo cuando es el primer montaje, conservando las clases base', () => {
    expect(claseEntradaEscalonada(true, 'prod-grid')).toBe(`prod-grid ${CLASE_ENTRADA_ESCALONADA}`);
    expect(claseEntradaEscalonada(false, 'prod-grid')).toBe('prod-grid');
    expect(claseEntradaEscalonada(true)).toBe(CLASE_ENTRADA_ESCALONADA);
    expect(claseEntradaEscalonada(false)).toBe('');
  });
});
