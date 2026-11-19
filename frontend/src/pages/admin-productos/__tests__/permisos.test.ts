import { describe, expect, it } from 'vitest';
import { accionesProductos } from '../model';

describe('accionesProductos', () => {
  it('STOCK solo puede operar el inventario', () => {
    expect(accionesProductos(['STOCK'])).toEqual({ gestionar: false, inventario: true });
  });

  it('ADMIN con STOCK puede todo', () => {
    expect(accionesProductos(['ADMIN', 'STOCK'])).toEqual({ gestionar: true, inventario: true });
  });

  it('ADMIN solo también gestiona y opera el inventario', () => {
    expect(accionesProductos(['ADMIN'])).toEqual({ gestionar: true, inventario: true });
  });

  it('CLIENT y los roles vacíos no pueden nada', () => {
    expect(accionesProductos(['CLIENT'])).toEqual({ gestionar: false, inventario: false });
    expect(accionesProductos([])).toEqual({ gestionar: false, inventario: false });
  });
});
