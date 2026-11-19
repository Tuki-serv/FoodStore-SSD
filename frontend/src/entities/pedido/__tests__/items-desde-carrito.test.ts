import { describe, expect, it } from 'vitest';
import { itemsDesdeCarrito } from '../model';

describe('itemsDesdeCarrito', () => {
  it('arma los items del pedido con la personalización ordenada', () => {
    const items = itemsDesdeCarrito([
      { productoId: 1, cantidad: 2, personalizacion: [3, 1] },
      { productoId: 5, cantidad: 1, personalizacion: [] },
    ]);

    expect(items).toEqual([
      { producto_id: 1, cantidad: 2, personalizacion: [1, 3] },
      { producto_id: 5, cantidad: 1, personalizacion: [] },
    ]);
  });

  it('preserva el orden de las líneas', () => {
    const items = itemsDesdeCarrito([
      { productoId: 9, cantidad: 1, personalizacion: [] },
      { productoId: 2, cantidad: 4, personalizacion: [7] },
      { productoId: 5, cantidad: 3, personalizacion: [] },
    ]);

    expect(items.map((item) => item.producto_id)).toEqual([9, 2, 5]);
  });

  it('ids ya ordenados quedan igual', () => {
    expect(itemsDesdeCarrito([{ productoId: 1, cantidad: 1, personalizacion: [2, 4, 6] }])).toEqual([
      { producto_id: 1, cantidad: 1, personalizacion: [2, 4, 6] },
    ]);
  });

  it('no muta la entrada', () => {
    const lineas = [{ productoId: 1, cantidad: 2, personalizacion: [3, 1] }];

    itemsDesdeCarrito(lineas);

    expect(lineas).toEqual([{ productoId: 1, cantidad: 2, personalizacion: [3, 1] }]);
  });

  it('sin líneas devuelve una lista vacía', () => {
    expect(itemsDesdeCarrito([])).toEqual([]);
  });
});
