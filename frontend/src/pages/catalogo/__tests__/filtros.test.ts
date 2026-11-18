import { describe, expect, it } from 'vitest';
import { arbolSeed } from '@/test/msw/catalogo';
import {
  aParametrosApi,
  contarFiltros,
  filtrosAUrl,
  filtrosDesdeUrl,
  TAMANO_PAGINA,
  validarRangoPrecio,
  type FiltrosUrl,
} from '../model';

const desde = (busqueda: string, arbol?: typeof arbolSeed) => filtrosDesdeUrl(new URLSearchParams(busqueda), arbol);

describe('filtrosDesdeUrl', () => {
  it('lee todos los filtros de una URL válida', () => {
    expect(desde('categoria=2&q=lim&min=1000&max=2000&stock=1&page=2')).toEqual({
      categoria: 2,
      q: 'lim',
      min: 1000,
      max: 2000,
      stock: true,
      page: 2,
    });
  });

  it('sin parámetros: página 1, sin stock y sin ningún otro filtro', () => {
    expect(desde('')).toEqual({ stock: false, page: 1 });
  });

  it('ignora una página inválida (-4, 0, abc, 1.5) y usa la 1', () => {
    for (const valor of ['-4', '0', 'abc', '1.5', '']) {
      expect(desde(`page=${valor}`).page).toBe(1);
    }
  });

  it('ignora un precio mínimo o máximo que no es un entero no negativo', () => {
    expect(desde('min=abc')).toEqual({ stock: false, page: 1 });
    expect(desde('min=-5&max=1.5')).toEqual({ stock: false, page: 1 });
    expect(desde('max=0')).toEqual({ stock: false, page: 1, max: 0 });
  });

  it('si el mínimo supera al máximo ignora ambos', () => {
    expect(desde('min=3000&max=1000')).toEqual({ stock: false, page: 1 });
  });

  it('stock solo vale con «1»', () => {
    expect(desde('stock=1').stock).toBe(true);
    expect(desde('stock=true').stock).toBe(false);
    expect(desde('stock=0').stock).toBe(false);
  });

  it('recorta los espacios de q y lo omite si queda vacío', () => {
    expect(desde('q=%20%20burger%20%20').q).toBe('burger');
    expect(desde('q=%20%20').q).toBeUndefined();
  });

  it('ignora una categoría que no es un entero positivo', () => {
    expect(desde('categoria=abc').categoria).toBeUndefined();
    expect(desde('categoria=0').categoria).toBeUndefined();
  });

  it('con el árbol cargado, ignora una categoría que no existe y conserva una que sí (también una hija)', () => {
    expect(desde('categoria=99', arbolSeed).categoria).toBeUndefined();
    expect(desde('categoria=4', arbolSeed).categoria).toBe(4);
    expect(desde('categoria=99').categoria).toBe(99);
  });
});

describe('filtrosAUrl', () => {
  it('escribe solo lo aplicado y omite la página 1', () => {
    const filtros: FiltrosUrl = { categoria: 1, q: 'burger', min: 1000, stock: true, page: 1 };

    expect(filtrosAUrl(filtros).toString()).toBe('categoria=1&q=burger&min=1000&stock=1');
  });

  it('incluye la página desde la 2', () => {
    expect(filtrosAUrl({ stock: false, page: 3 }).toString()).toBe('page=3');
  });

  it('sin filtros queda vacío', () => {
    expect(filtrosAUrl({ stock: false, page: 1 }).toString()).toBe('');
  });

  it('un máximo de 0 se conserva', () => {
    expect(filtrosAUrl({ max: 0, stock: false, page: 1 }).toString()).toBe('max=0');
  });
});

describe('aParametrosApi', () => {
  it('traduce al contrato con el tamaño de página fijo', () => {
    expect(TAMANO_PAGINA).toBe(12);
    expect(aParametrosApi({ q: 'lim', min: 1000, max: 2000, stock: true, page: 2 })).toEqual({
      page: 2,
      size: 12,
      q: 'lim',
      precioMin: 1000,
      precioMax: 2000,
      conStock: true,
    });
  });

  it('una categoría con el árbol pide ella y todas sus descendientes', () => {
    expect(aParametrosApi({ categoria: 1, stock: false, page: 1 }, arbolSeed).categoriaIds).toEqual([1, 4, 5]);
  });

  it('una categoría sin el árbol todavía pide solo ella', () => {
    expect(aParametrosApi({ categoria: 2, stock: false, page: 1 }).categoriaIds).toEqual([2]);
  });

  it('sin filtros pide solo la página y el tamaño', () => {
    expect(aParametrosApi({ stock: false, page: 1 })).toEqual({ page: 1, size: 12 });
  });
});

describe('validarRangoPrecio', () => {
  it('acepta ambos vacíos, solo uno o los dos', () => {
    expect(validarRangoPrecio('', '')).toEqual({ ok: true, min: undefined, max: undefined });
    expect(validarRangoPrecio('1000', '')).toEqual({ ok: true, min: 1000, max: undefined });
    expect(validarRangoPrecio(' 1000 ', '2000')).toEqual({ ok: true, min: 1000, max: 2000 });
    expect(validarRangoPrecio('1000', '1000')).toEqual({ ok: true, min: 1000, max: 1000 });
  });

  it('un valor que no es un entero no negativo da «Ingresá un número entero» en su campo', () => {
    expect(validarRangoPrecio('1,5', '')).toEqual({ ok: false, errores: { min: 'Ingresá un número entero' } });
    expect(validarRangoPrecio('', '-3')).toEqual({ ok: false, errores: { max: 'Ingresá un número entero' } });
    expect(validarRangoPrecio('abc', '1.5')).toEqual({
      ok: false,
      errores: { min: 'Ingresá un número entero', max: 'Ingresá un número entero' },
    });
  });

  it('un mínimo mayor que el máximo da el error en el máximo', () => {
    expect(validarRangoPrecio('3000', '1000')).toEqual({ ok: false, errores: { max: 'El mínimo no puede superar al máximo' } });
  });
});

describe('contarFiltros', () => {
  it('cuenta categoría, búsqueda, precio (aunque sean dos extremos) y stock', () => {
    expect(contarFiltros({ stock: false, page: 3 })).toBe(0);
    expect(contarFiltros({ categoria: 1, q: 'x', min: 1, max: 2, stock: true, page: 1 })).toBe(4);
    expect(contarFiltros({ max: 0, stock: false, page: 1 })).toBe(1);
  });
});
