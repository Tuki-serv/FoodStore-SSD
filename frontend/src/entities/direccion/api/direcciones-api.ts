import { apiClient, type Paginado } from '@/shared/api';
import type { Direccion, DireccionDatos } from '../model';

export interface ParametrosListaDirecciones {
  page: number;
  size: number;
}

/** `GET /direcciones/`: las activas del usuario, la principal primero y luego por `id`. */
export async function listarDirecciones(params: ParametrosListaDirecciones): Promise<Paginado<Direccion>> {
  const { data } = await apiClient.get<Paginado<Direccion>>('/direcciones/', { params });
  return data;
}

export async function crearDireccion(datos: DireccionDatos): Promise<Direccion> {
  const { data } = await apiClient.post<Direccion>('/direcciones/', datos);
  return data;
}

/** `PATCH /direcciones/{id}` con el objeto completo (los opcionales vaciados viajan como `null` y se borran). */
export async function actualizarDireccion(id: number, datos: DireccionDatos): Promise<Direccion> {
  const { data } = await apiClient.patch<Direccion>(`/direcciones/${id}`, datos);
  return data;
}

/** `PATCH /direcciones/{id}/principal`: sin cuerpo; el backend desmarca la anterior. */
export async function marcarDireccionPrincipal(id: number): Promise<Direccion> {
  const { data } = await apiClient.patch<Direccion>(`/direcciones/${id}/principal`);
  return data;
}

/** `DELETE /direcciones/{id}`: 204; borrado lógico. */
export async function eliminarDireccion(id: number): Promise<void> {
  await apiClient.delete(`/direcciones/${id}`);
}
