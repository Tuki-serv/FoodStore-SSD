import { describe, expect, it } from 'vitest';
import { RUTA_PRODUCTO, rutaProducto } from '..';

describe('rutaProducto', () => {
  it('arma el path del detalle con el id', () => {
    expect(rutaProducto(7)).toBe('/catalogo/7');
    expect(rutaProducto(120)).toBe('/catalogo/120');
  });

  it('RUTA_PRODUCTO es el patrón del router', () => {
    expect(RUTA_PRODUCTO).toBe('/catalogo/:productoId');
  });
});
