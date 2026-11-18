import { apiClient, type Paginado } from '@/shared/api';
import type { Ingrediente, IngredienteCambios, IngredienteCreado, IngredienteDatos } from '../model';

export interface ParametrosListaIngredientes {
  page: number;
  size: number;
  /** `true` = solo alérgenos, `false` = solo no alérgenos, `null` = todos (el parámetro se omite). */
  alergeno: boolean | null;
}

/** `GET /ingredientes/`: activos, paginados, con los productos que los usan; `is_alergeno` filtra. */
export async function listarIngredientes({ page, size, alergeno }: ParametrosListaIngredientes): Promise<Paginado<Ingrediente>> {
  const { data } = await apiClient.get<Paginado<Ingrediente>>('/ingredientes/', {
    params: { page, size, ...(alergeno === null ? {} : { is_alergeno: alergeno }) },
  });
  return data;
}

/** `POST /ingredientes/` (ADMIN): 201; 409 `DUPLICATE_VALUE` (nombre). */
export async function crearIngrediente(datos: IngredienteDatos): Promise<IngredienteCreado> {
  const { data } = await apiClient.post<IngredienteCreado>('/ingredientes/', datos);
  return data;
}

/** `PATCH /ingredientes/{id}` (ADMIN): parcial. */
export async function editarIngrediente(id: number, cambios: IngredienteCambios): Promise<void> {
  await apiClient.patch(`/ingredientes/${id}`, cambios);
}

/** `DELETE /ingredientes/{id}` (ADMIN): 204, borrado lógico; el servidor no valida productos asociados. */
export async function eliminarIngrediente(id: number): Promise<void> {
  await apiClient.delete(`/ingredientes/${id}`);
}
