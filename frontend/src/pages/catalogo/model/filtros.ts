import { buscarCategoria, idsDelSubarbol, type CategoriaNodo } from '@/entities/categoria';
import type { FiltrosProductos } from '@/entities/producto';

/** Productos por página: grillas de 2, 3 y 4 columnas sin huecos (decisión del usuario, OQ-6). */
export const TAMANO_PAGINA = 12;

/** Filtros del catálogo tal como viven en la URL (`categoria`, `q`, `min`, `max`, `stock`, `page`). */
export interface FiltrosUrl {
  categoria?: number;
  q?: string;
  min?: number;
  max?: number;
  stock: boolean;
  page: number;
}

const ENTERO = /^\d+$/;

const enteroNoNegativo = (valor: string | null): number | undefined => {
  if (valor === null || !ENTERO.test(valor)) return undefined;
  const numero = Number(valor);
  return Number.isSafeInteger(numero) ? numero : undefined;
};

const enteroPositivo = (valor: string | null): number | undefined => {
  const numero = enteroNoNegativo(valor);
  return numero === undefined || numero < 1 ? undefined : numero;
};

/**
 * Lee los filtros de la URL ignorando lo inválido: página y categoría deben ser enteros positivos, precios enteros >= 0
 * (con `min > max` se descartan ambos), `stock` vale solo con «1» y `q` se recorta. Con el árbol cargado, una categoría
 * que no existe también se ignora.
 */
export function filtrosDesdeUrl(params: URLSearchParams, arbol?: readonly CategoriaNodo[]): FiltrosUrl {
  const categoriaCruda = enteroPositivo(params.get('categoria'));
  const categoria = categoriaCruda !== undefined && (arbol === undefined || buscarCategoria(arbol, categoriaCruda) !== undefined) ? categoriaCruda : undefined;
  const q = params.get('q')?.trim() ?? '';
  let min = enteroNoNegativo(params.get('min'));
  let max = enteroNoNegativo(params.get('max'));
  if (min !== undefined && max !== undefined && min > max) {
    min = undefined;
    max = undefined;
  }
  return {
    ...(categoria === undefined ? {} : { categoria }),
    ...(q === '' ? {} : { q }),
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    stock: params.get('stock') === '1',
    page: enteroPositivo(params.get('page')) ?? 1,
  };
}

/** `true` si la URL trae una `categoria` con forma válida (exista o no en el árbol). */
export const hayCategoriaEnUrl = (params: URLSearchParams): boolean => enteroPositivo(params.get('categoria')) !== undefined;

/** Escribe solo lo aplicado; la página 1 se omite. */
export function filtrosAUrl(filtros: FiltrosUrl): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.categoria !== undefined) params.set('categoria', String(filtros.categoria));
  if (filtros.q !== undefined) params.set('q', filtros.q);
  if (filtros.min !== undefined) params.set('min', String(filtros.min));
  if (filtros.max !== undefined) params.set('max', String(filtros.max));
  if (filtros.stock) params.set('stock', '1');
  if (filtros.page > 1) params.set('page', String(filtros.page));
  return params;
}

/** Filtros de la URL → pedido al backend: la categoría elegida viaja junto con todas sus descendientes (DU-3). */
export function aParametrosApi(filtros: FiltrosUrl, arbol?: readonly CategoriaNodo[]): FiltrosProductos {
  const { categoria, q, min, max, stock, page } = filtros;
  const categoriaIds = categoria === undefined ? undefined : arbol === undefined ? [categoria] : idsDelSubarbol(arbol, categoria);
  return {
    page,
    size: TAMANO_PAGINA,
    ...(q === undefined ? {} : { q }),
    ...(categoriaIds === undefined ? {} : { categoriaIds }),
    ...(min === undefined ? {} : { precioMin: min }),
    ...(max === undefined ? {} : { precioMax: max }),
    ...(stock ? { conStock: true } : {}),
  };
}

/** Cantidad de filtros aplicados (el rango de precio cuenta como uno). */
export function contarFiltros(filtros: FiltrosUrl): number {
  return (
    Number(filtros.categoria !== undefined) +
    Number(filtros.q !== undefined) +
    Number(filtros.min !== undefined || filtros.max !== undefined) +
    Number(filtros.stock)
  );
}

export type ResultadoRango =
  | { ok: true; min: number | undefined; max: number | undefined }
  | { ok: false; errores: { min?: string; max?: string } };

const ERROR_ENTERO = 'Ingresá un número entero';
const ERROR_ORDEN = 'El mínimo no puede superar al máximo';

/** Valida los dos campos de precio (texto): vacío = sin tope; enteros no negativos; el mínimo no puede superar al máximo. */
export function validarRangoPrecio(minimo: string, maximo: string): ResultadoRango {
  const textoMin = minimo.trim();
  const textoMax = maximo.trim();
  const min = textoMin === '' ? undefined : enteroNoNegativo(textoMin);
  const max = textoMax === '' ? undefined : enteroNoNegativo(textoMax);
  const errores: { min?: string; max?: string } = {};
  if (textoMin !== '' && min === undefined) errores.min = ERROR_ENTERO;
  if (textoMax !== '' && max === undefined) errores.max = ERROR_ENTERO;
  if (errores.min === undefined && errores.max === undefined && min !== undefined && max !== undefined && min > max) errores.max = ERROR_ORDEN;
  if (errores.min !== undefined || errores.max !== undefined) return { ok: false, errores };
  return { ok: true, min, max };
}
