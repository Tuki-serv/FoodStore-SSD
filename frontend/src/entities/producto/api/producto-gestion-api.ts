import { apiClient, type Paginado } from '@/shared/api';
import type { Producto, ProductoCambios, ProductoDatos } from '../model';

/** Filtros del listado de gestión (camelCase); a diferencia del catálogo, `disponible` no se fuerza. */
export interface FiltrosGestion {
  page: number;
  size: number;
  q?: string;
  categoriaId?: number;
  /** `true` solo disponibles, `false` solo no disponibles, ausente todos (el parámetro se omite). */
  disponible?: boolean;
}

/** Forma canónica: sin claves vacías, para que dos URLs equivalentes compartan caché. */
export function normalizarFiltrosGestion({ page, size, q, categoriaId, disponible }: FiltrosGestion): FiltrosGestion {
  return {
    page,
    size,
    ...(q === undefined || q === '' ? {} : { q }),
    ...(categoriaId === undefined ? {} : { categoriaId }),
    ...(disponible === undefined ? {} : { disponible }),
  };
}

/** `GET /productos/` para ADMIN/STOCK: activos, incluidos los no disponibles; orden por id. */
export async function listarProductosGestion(filtros: FiltrosGestion): Promise<Paginado<Producto>> {
  const { page, size, q, categoriaId, disponible } = normalizarFiltrosGestion(filtros);
  const params = { page, size, q, categoria_ids: categoriaId, disponible };
  const { data } = await apiClient.get<Paginado<Producto>>('/productos/', { params, paramsSerializer: { indexes: null } });
  return data;
}

/** `GET /productos/{id}`: visible para ADMIN/STOCK aunque no esté disponible; 404 si no existe o fue eliminado. */
export async function obtenerProductoGestion(id: number): Promise<Producto> {
  const { data } = await apiClient.get<Producto>(`/productos/${id}`);
  return data;
}

/** `POST /productos/` (ADMIN): 201 con el producto; 409 `DUPLICATE_VALUE` (nombre); 404 si falta una categoría, ingrediente o unidad. */
export async function crearProducto(datos: ProductoDatos): Promise<Producto> {
  const { data } = await apiClient.post<Producto>('/productos/', datos);
  return data;
}

/** `PUT /productos/{id}` (ADMIN): parcial; solo viaja lo que cambió. */
export async function editarProducto(id: number, cambios: ProductoCambios): Promise<Producto> {
  const { data } = await apiClient.put<Producto>(`/productos/${id}`, cambios);
  return data;
}

/** `DELETE /productos/{id}` (ADMIN): 204, borrado lógico. */
export async function eliminarProducto(id: number): Promise<void> {
  await apiClient.delete(`/productos/${id}`);
}

/** `PATCH /productos/{id}/stock` (ADMIN/STOCK): seteo absoluto e idempotente. */
export async function fijarStock(id: number, stock: number): Promise<Producto> {
  const { data } = await apiClient.patch<Producto>(`/productos/${id}/stock`, { stock_cantidad: stock });
  return data;
}

/** `PATCH /productos/{id}/disponibilidad` (ADMIN/STOCK): independiente del stock (RN-PR-02). */
export async function fijarDisponibilidad(id: number, disponible: boolean): Promise<Producto> {
  const { data } = await apiClient.patch<Producto>(`/productos/${id}/disponibilidad`, { disponible });
  return data;
}
