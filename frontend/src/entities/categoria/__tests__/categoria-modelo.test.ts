import { describe, expect, it } from 'vitest';
import { arbolSeed, categoriaNodoDto } from '@/test/msw/catalogo';
import { buscarCategoria, idsDelSubarbol, raices } from '../index';

const tresNiveles = [
  categoriaNodoDto({
    id: 10,
    nombre: 'Comidas',
    subcategorias: [
      categoriaNodoDto({ id: 11, nombre: 'Pizzas', parent_id: 10, subcategorias: [categoriaNodoDto({ id: 12, nombre: 'Napolitanas', parent_id: 11 })] }),
    ],
  }),
  categoriaNodoDto({ id: 20, nombre: 'Otras' }),
];

describe('idsDelSubarbol', () => {
  it('«Hamburguesas» (1) incluye a «Veganas» (4) y «Sin TACC» (5)', () => {
    expect(idsDelSubarbol(arbolSeed, 1)).toEqual([1, 4, 5]);
  });

  it('una hoja devuelve solo su id', () => {
    expect(idsDelSubarbol(arbolSeed, 4)).toEqual([4]);
  });

  it('un id inexistente devuelve una lista vacía', () => {
    expect(idsDelSubarbol(arbolSeed, 99)).toEqual([]);
  });

  it('con tres niveles incluye a los nietos', () => {
    expect(idsDelSubarbol(tresNiveles, 10)).toEqual([10, 11, 12]);
  });
});

describe('buscarCategoria', () => {
  it('encuentra un nieto', () => {
    expect(buscarCategoria(tresNiveles, 12)?.nombre).toBe('Napolitanas');
  });

  it('devuelve undefined para un id inexistente', () => {
    expect(buscarCategoria(tresNiveles, 99)).toBeUndefined();
  });
});

describe('raices', () => {
  it('devuelve las de primer nivel en el orden del servidor', () => {
    expect(raices(arbolSeed).map((nodo) => nodo.nombre)).toEqual(['Bebidas', 'Hamburguesas', 'Postres']);
  });
});
