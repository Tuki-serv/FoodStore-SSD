import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_CART_STORAGE,
  claveLinea,
  selectLinea,
  selectTotalItems,
  selectTotalPrecio,
  useCartStore,
  type ProductoParaCarrito,
} from '..';

const hamburguesa: ProductoParaCarrito = { productoId: 7, nombre: 'Hamburguesa', precioUnitario: '1250.50', imagenUrl: null };
const gaseosa: ProductoParaCarrito = { productoId: 9, nombre: 'Gaseosa', precioUnitario: '0.10', imagenUrl: 'https://img.example/g.png' };

const carrito = () => useCartStore.getState();
const guardado = (): string | null => window.localStorage.getItem(CLAVE_CART_STORAGE);

describe('agregar al carrito', () => {
  beforeEach(() => {
    carrito().reset();
  });

  it('mismo producto y personalización (sin importar el orden) suma cantidades en una sola línea', () => {
    carrito().agregar(hamburguesa, 1, [3, 1]);
    carrito().agregar(hamburguesa, 2, [1, 3]);

    expect(carrito().lineas).toHaveLength(1);
    expect(carrito().lineas[0]).toEqual({ ...hamburguesa, cantidad: 3, personalizacion: [1, 3] });
  });

  it('otra personalización crea otra línea', () => {
    carrito().agregar(hamburguesa, 1, [1]);
    carrito().agregar(hamburguesa, 1);

    expect(carrito().lineas.map((linea) => [linea.productoId, linea.personalizacion])).toEqual([
      [7, [1]],
      [7, []],
    ]);
  });

  it('productos distintos son líneas distintas', () => {
    carrito().agregar(hamburguesa);
    carrito().agregar(gaseosa);

    expect(carrito().lineas.map((linea) => linea.productoId)).toEqual([7, 9]);
  });

  it('una cantidad que no es un entero positivo no agrega nada', () => {
    carrito().agregar(hamburguesa, 0);
    carrito().agregar(hamburguesa, -2);
    carrito().agregar(hamburguesa, 1.5);

    expect(carrito().lineas).toEqual([]);
  });

  it('un precio que no es un decimal válido no agrega nada', () => {
    carrito().agregar({ ...hamburguesa, precioUnitario: 'abc' });
    carrito().agregar({ ...hamburguesa, precioUnitario: '-3.00' });

    expect(carrito().lineas).toEqual([]);
  });

  it('claveLinea ignora el orden y los repetidos de la personalización', () => {
    expect(claveLinea(7, [3, 1])).toBe('7:1,3');
    expect(claveLinea(7, [1, 3, 3])).toBe('7:1,3');
    expect(claveLinea(7, [])).toBe('7:');
  });
});

describe('cantidades', () => {
  beforeEach(() => {
    carrito().reset();
    carrito().agregar(hamburguesa, 2);
  });

  it('fijarCantidad cambia la cantidad de la línea', () => {
    carrito().fijarCantidad(claveLinea(7, []), 5);

    expect(carrito().lineas[0]?.cantidad).toBe(5);
  });

  it('fijarCantidad en 0 quita la única línea y el carrito queda vacío', () => {
    carrito().fijarCantidad(claveLinea(7, []), 0);

    expect(carrito().lineas).toEqual([]);
  });

  it('fijarCantidad en un negativo también quita la línea', () => {
    carrito().fijarCantidad(claveLinea(7, []), -1);

    expect(carrito().lineas).toEqual([]);
  });

  it('fijarCantidad en 1.5 no cambia nada', () => {
    carrito().fijarCantidad(claveLinea(7, []), 1.5);

    expect(carrito().lineas[0]?.cantidad).toBe(2);
  });

  it('fijarCantidad sobre una línea inexistente no cambia nada', () => {
    carrito().fijarCantidad('99:', 4);

    expect(carrito().lineas).toHaveLength(1);
  });

  it('quitar elimina solo esa línea y vaciar elimina todas', () => {
    carrito().agregar(gaseosa, 1);

    carrito().quitar(claveLinea(7, []));
    expect(carrito().lineas.map((linea) => linea.productoId)).toEqual([9]);

    carrito().vaciar();
    expect(carrito().lineas).toEqual([]);
  });
});

describe('totales', () => {
  beforeEach(() => {
    carrito().reset();
  });

  it('3 unidades a «0.10» y 1 a «1250.50»: 4 unidades e importe «1250.80» sin error de redondeo binario', () => {
    carrito().agregar(gaseosa, 3);
    carrito().agregar(hamburguesa, 1);

    expect(selectTotalItems(carrito())).toBe(4);
    expect(selectTotalPrecio(carrito())).toBe('1250.80');
  });

  it('carrito vacío: 0 unidades e importe «0.00»', () => {
    expect(selectTotalItems(carrito())).toBe(0);
    expect(selectTotalPrecio(carrito())).toBe('0.00');
  });

  it('precios sin decimales o con uno se normalizan a dos decimales', () => {
    carrito().agregar({ ...gaseosa, precioUnitario: '5' }, 2);
    carrito().agregar({ ...hamburguesa, precioUnitario: '2.5' }, 1);

    expect(selectTotalPrecio(carrito())).toBe('12.50');
  });

  it('selectLinea devuelve la línea por su clave', () => {
    carrito().agregar(hamburguesa, 2, [4]);

    expect(selectLinea(claveLinea(7, [4]))(carrito())?.cantidad).toBe(2);
    expect(selectLinea('7:')(carrito())).toBeUndefined();
  });
});

describe('persistencia', () => {
  beforeEach(() => {
    carrito().reset();
  });

  it('guarda las líneas en localStorage y las recupera al recargar', async () => {
    carrito().agregar(hamburguesa, 2);
    const copia = guardado();
    expect(copia).not.toBeNull();

    carrito().vaciar();
    window.localStorage.setItem(CLAVE_CART_STORAGE, copia ?? '');
    await useCartStore.persist.rehydrate();

    expect(carrito().lineas).toEqual([{ ...hamburguesa, cantidad: 2, personalizacion: [] }]);
  });

  it('una entrada guardada que no es JSON válido deja el carrito vacío sin lanzar', async () => {
    window.localStorage.setItem(CLAVE_CART_STORAGE, '{no es json');

    await expect(useCartStore.persist.rehydrate()).resolves.not.toThrow();

    expect(carrito().lineas).toEqual([]);
  });

  it.each([
    ['líneas con la forma equivocada', { state: { lineas: [{ productoId: 'siete', cantidad: 2 }] }, version: 1 }],
    ['cantidad no entera', { state: { lineas: [{ ...hamburguesa, cantidad: 1.5, personalizacion: [] }] }, version: 1 }],
    ['lineas que no es una lista', { state: { lineas: 'x' }, version: 1 }],
  ])('datos guardados inválidos (%s) dejan el carrito vacío', async (_nombre, contenido) => {
    window.localStorage.setItem(CLAVE_CART_STORAGE, JSON.stringify(contenido));

    await useCartStore.persist.rehydrate();

    expect(carrito().lineas).toEqual([]);
  });

  describe('con el almacenamiento roto', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('si leer lanza, el carrito arranca vacío y sigue funcionando en memoria', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('almacenamiento bloqueado');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('cuota excedida');
      });

      await useCartStore.persist.rehydrate();
      carrito().agregar(hamburguesa, 2);

      expect(carrito().lineas).toEqual([{ ...hamburguesa, cantidad: 2, personalizacion: [] }]);
    });
  });

  it('reset vacía el carrito y también su copia persistida', () => {
    carrito().agregar(hamburguesa, 2);

    carrito().reset();

    expect(carrito().lineas).toEqual([]);
    const copia = guardado();
    expect(copia === null || (JSON.parse(copia) as { state: { lineas: unknown[] } }).state.lineas.length === 0).toBe(true);
  });

  it('no guarda datos del servidor ni funciones: solo las líneas', () => {
    carrito().agregar(hamburguesa, 1);

    const copia = JSON.parse(guardado() ?? '{}') as { state: Record<string, unknown> };
    expect(Object.keys(copia.state)).toEqual(['lineas']);
  });
});
