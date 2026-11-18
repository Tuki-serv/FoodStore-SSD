import { describe, expect, it } from 'vitest';
import { productoDto } from '@/test/msw/catalogo';
import { alergenos, aProductoParaCarrito, categoriaPrincipal, estadoStock, formatearPrecio, imagenPrincipal } from '../index';

describe('formatearPrecio', () => {
  it('«12000.00» se muestra «$ 12.000»', () => {
    expect(formatearPrecio('12000.00')).toBe('$ 12.000');
  });

  it.each([
    ['1250.50', '$ 1.250,50'],
    ['700.00', '$ 700'],
    ['1234567.05', '$ 1.234.567,05'],
    ['0.00', '$ 0'],
    ['1500', '$ 1.500'],
    ['99.9', '$ 99,90'],
  ])('«%s» se muestra «%s»', (decimal, esperado) => {
    expect(formatearPrecio(decimal)).toBe(esperado);
  });
});

describe('estadoStock', () => {
  it.each([
    [0, 'agotado'],
    [1, 'pocas'],
    [5, 'pocas'],
    [6, 'normal'],
    [100, 'normal'],
  ] as const)('stock %i → %s', (stock, esperado) => {
    expect(estadoStock(stock)).toBe(esperado);
  });
});

describe('alergenos', () => {
  it('devuelve solo los ingredientes con es_alergeno, en el orden del servidor', () => {
    const producto = productoDto({
      id: 1,
      ingredientes: [
        { id: 1, nombre: 'Pan Brioche', es_alergeno: true, es_removible: false, cantidad: '1.000', unidad_medida_id: 1 },
        { id: 2, nombre: 'Lechuga', es_alergeno: false, es_removible: true, cantidad: '1.000', unidad_medida_id: 1 },
        { id: 3, nombre: 'Mayonesa', es_alergeno: true, es_removible: true, cantidad: '1.000', unidad_medida_id: 1 },
      ],
    });

    expect(alergenos(producto).map((i) => i.nombre)).toEqual(['Pan Brioche', 'Mayonesa']);
  });

  it('sin ingredientes devuelve una lista vacía', () => {
    expect(alergenos(productoDto({ id: 1, ingredientes: [] }))).toEqual([]);
  });
});

describe('categoriaPrincipal', () => {
  it('elige la marcada como principal aunque no sea la primera', () => {
    const producto = productoDto({
      id: 1,
      categorias: [
        { id: 4, nombre: 'Veganas', es_principal: false },
        { id: 1, nombre: 'Hamburguesas', es_principal: true },
      ],
    });

    expect(categoriaPrincipal(producto)?.nombre).toBe('Hamburguesas');
  });

  it('sin principal usa la primera', () => {
    const producto = productoDto({ id: 1, categorias: [{ id: 4, nombre: 'Veganas', es_principal: false }] });

    expect(categoriaPrincipal(producto)?.nombre).toBe('Veganas');
  });

  it('sin categorías devuelve null', () => {
    expect(categoriaPrincipal(productoDto({ id: 1, categorias: [] }))).toBeNull();
  });
});

describe('imagenPrincipal', () => {
  it('devuelve la primera URL', () => {
    expect(imagenPrincipal(productoDto({ id: 1, imagenes_url: ['https://img/a.png', 'https://img/b.png'] }))).toBe('https://img/a.png');
  });

  it.each([[null], [[]]])('con imagenes_url %j devuelve null', (imagenes) => {
    expect(imagenPrincipal(productoDto({ id: 1, imagenes_url: imagenes }))).toBeNull();
  });
});

describe('aProductoParaCarrito', () => {
  it('toma id, nombre, precio decimal e imagen principal', () => {
    const producto = productoDto({ id: 1, nombre: 'Hamburguesa Clásica', precio_base: '1500.00', imagenes_url: ['https://img/a.png'] });

    expect(aProductoParaCarrito(producto)).toEqual({
      productoId: 1,
      nombre: 'Hamburguesa Clásica',
      precioUnitario: '1500.00',
      imagenUrl: 'https://img/a.png',
    });
  });

  it('sin imagen, imagenUrl es null', () => {
    expect(aProductoParaCarrito(productoDto({ id: 2, imagenes_url: null })).imagenUrl).toBeNull();
  });
});
