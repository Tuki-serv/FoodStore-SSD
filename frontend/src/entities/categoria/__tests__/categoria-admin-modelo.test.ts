import { describe, expect, it } from 'vitest';
import { arbolSeed, categoriaNodoDto } from '@/test/msw/catalogo';
import { contarDescendientes, padresPosibles } from '../model';

describe('padresPosibles', () => {
  it('al editar «Hamburguesas» no ofrece ella ni sus subcategorías y mantiene el orden del árbol con niveles', () => {
    expect(padresPosibles(arbolSeed, 1)).toEqual([
      { id: 2, nombre: 'Bebidas', nivel: 0 },
      { id: 6, nombre: 'Gaseosas', nivel: 1 },
      { id: 3, nombre: 'Postres', nivel: 0 },
    ]);
  });

  it('sin id (alta) ofrece todas las categorías en orden de árbol con su nivel', () => {
    expect(padresPosibles(arbolSeed)).toEqual([
      { id: 2, nombre: 'Bebidas', nivel: 0 },
      { id: 6, nombre: 'Gaseosas', nivel: 1 },
      { id: 1, nombre: 'Hamburguesas', nivel: 0 },
      { id: 5, nombre: 'Sin TACC', nivel: 1 },
      { id: 4, nombre: 'Veganas', nivel: 1 },
      { id: 3, nombre: 'Postres', nivel: 0 },
    ]);
  });

  it('al editar una hoja («Veganas») ofrece todas menos ella', () => {
    expect(padresPosibles(arbolSeed, 4).map((p) => p.nombre)).toEqual(['Bebidas', 'Gaseosas', 'Hamburguesas', 'Sin TACC', 'Postres']);
  });

  it('con tres niveles excluye también a los nietos', () => {
    const arbol = [
      categoriaNodoDto({
        id: 10,
        nombre: 'Raíz',
        subcategorias: [
          categoriaNodoDto({ id: 11, nombre: 'Hija', parent_id: 10, subcategorias: [categoriaNodoDto({ id: 12, nombre: 'Nieta', parent_id: 11 })] }),
        ],
      }),
      categoriaNodoDto({ id: 13, nombre: 'Otra' }),
    ];

    expect(padresPosibles(arbol, 11)).toEqual([
      { id: 10, nombre: 'Raíz', nivel: 0 },
      { id: 13, nombre: 'Otra', nivel: 0 },
    ]);
  });
});

describe('contarDescendientes', () => {
  it('cuenta las subcategorías directas de «Hamburguesas»', () => {
    expect(contarDescendientes(arbolSeed, 1)).toBe(2);
  });

  it('una hoja o un id inexistente tiene 0', () => {
    expect(contarDescendientes(arbolSeed, 4)).toBe(0);
    expect(contarDescendientes(arbolSeed, 99)).toBe(0);
  });
});
