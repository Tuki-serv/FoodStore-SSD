import { apiClient } from '@/shared/api';
import type { CategoriaNodo } from '../model';

/** `GET /categorias/arbol`: público, solo activas, ordenado por nombre en cada nivel. */
export async function obtenerArbolCategorias(): Promise<CategoriaNodo[]> {
  const { data } = await apiClient.get<{ data: CategoriaNodo[]; total: number }>('/categorias/arbol');
  return data.data;
}
