import { apiClient, type Paginado } from '@/shared/api';
import type { Producto } from '../model';

/** Filtros del listado, en camelCase; `listarProductos` los traduce al contrato del backend. */
export interface FiltrosProductos {
  page: number;
  size: number;
  q?: string;
  categoriaIds?: number[];
  precioMin?: number;
  precioMax?: number;
  conStock?: boolean;
}

/** Forma canónica: sin claves vacías y con `categoriaIds` ordenados, para que dos URLs equivalentes compartan caché. */
export function normalizarFiltros(filtros: FiltrosProductos): FiltrosProductos {
  const { page, size, q, categoriaIds, precioMin, precioMax, conStock } = filtros;
  return {
    page,
    size,
    ...(q === undefined || q === '' ? {} : { q }),
    ...(categoriaIds === undefined || categoriaIds.length === 0 ? {} : { categoriaIds: [...categoriaIds].sort((a, b) => a - b) }),
    ...(precioMin === undefined ? {} : { precioMin }),
    ...(precioMax === undefined ? {} : { precioMax }),
    ...(conStock === true ? { conStock: true } : {}),
  };
}

/**
 * `GET /productos/`: el catálogo público pide siempre `disponible=true`. Las listas viajan repetidas
 * (`categoria_ids=1&categoria_ids=4`, lo que espera FastAPI): Axios las serializa con `[]` salvo `indexes: null`.
 */
export async function listarProductos(filtros: FiltrosProductos): Promise<Paginado<Producto>> {
  const { page, size, q, categoriaIds, precioMin, precioMax, conStock } = normalizarFiltros(filtros);
  const params = {
    page,
    size,
    disponible: true,
    q,
    categoria_ids: categoriaIds,
    precio_min: precioMin,
    precio_max: precioMax,
    con_stock: conStock,
  };
  const { data } = await apiClient.get<Paginado<Producto>>('/productos/', { params, paramsSerializer: { indexes: null } });
  return data;
}

/** `GET /productos/{id}`: 404 si no existe, está eliminado o no está disponible para el público. */
export async function obtenerProducto(id: number): Promise<Producto> {
  const { data } = await apiClient.get<Producto>(`/productos/${id}`);
  return data;
}
