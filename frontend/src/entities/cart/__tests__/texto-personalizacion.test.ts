import { describe, expect, it } from 'vitest';
import { textoPersonalizacion } from '..';

const base = { productoId: 7, nombre: 'Hamburguesa', precioUnitario: '1500.00', imagenUrl: null, cantidad: 1 };

describe('textoPersonalizacion', () => {
  it.each([
    [{ personalizacion: [1, 3], personalizacionNombres: ['Cebolla', 'Tomate'] }, 'Sin cebolla, sin tomate'],
    [{ personalizacion: [1], personalizacionNombres: ['Cebolla'] }, 'Sin cebolla'],
    [{ personalizacion: [], personalizacionNombres: [] }, null],
    [{ personalizacion: [1, 2], personalizacionNombres: [] }, 'Sin 2 ingredientes'],
    [{ personalizacion: [9], personalizacionNombres: [] }, 'Sin 1 ingrediente'],
  ])('%j → %s', (personalizacion, esperado) => {
    expect(textoPersonalizacion({ ...base, ...personalizacion })).toBe(esperado);
  });
});
