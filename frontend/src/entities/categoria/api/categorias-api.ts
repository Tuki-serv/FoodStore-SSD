import { apiClient } from '@/shared/api';
import type { CategoriaCambios, CategoriaCreada, CategoriaDatos, CategoriaNodo } from '../model';

/** `GET /categorias/arbol`: público, solo activas, ordenado por nombre en cada nivel. */
export async function obtenerArbolCategorias(): Promise<CategoriaNodo[]> {
  const { data } = await apiClient.get<{ data: CategoriaNodo[]; total: number }>('/categorias/arbol');
  return data.data;
}

/** `POST /categorias/` (ADMIN): 201; 409 `DUPLICATE_VALUE` (nombre), 404 si el padre no existe. */
export async function crearCategoria(datos: CategoriaDatos): Promise<CategoriaCreada> {
  const { data } = await apiClient.post<CategoriaCreada>('/categorias/', datos);
  return data;
}

/** `PATCH /categorias/{id}` (ADMIN): parcial; 400 si formaría un ciclo. */
export async function editarCategoria(id: number, cambios: CategoriaCambios): Promise<void> {
  await apiClient.patch(`/categorias/${id}`, cambios);
}

/** `DELETE /categorias/{id}` (ADMIN): 204, borrado lógico; 409 `CATEGORY_HAS_PRODUCTS` o `CATEGORY_HAS_CHILDREN`. */
export async function eliminarCategoria(id: number): Promise<void> {
  await apiClient.delete(`/categorias/${id}`);
}
