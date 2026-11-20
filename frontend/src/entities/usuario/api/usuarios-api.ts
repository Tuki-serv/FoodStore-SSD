import { apiClient, type Paginado } from '@/shared/api';
import { TAMANO_PAGINA_USUARIOS, type CambiosUsuario, type DatosAltaUsuario, type FiltrosUsuarios, type UsuarioAdmin } from '../model';

/** `GET /admin/usuarios/` (ADMIN): activos, paginados; `rol_codigo` solo si hay un rol elegido (desconocido → 400). */
export async function listarUsuarios({ rol, page }: FiltrosUsuarios): Promise<Paginado<UsuarioAdmin>> {
  const { data } = await apiClient.get<Paginado<UsuarioAdmin>>('/admin/usuarios/', {
    params: { ...(rol === null ? {} : { rol_codigo: rol }), page, size: TAMANO_PAGINA_USUARIOS },
  });
  return data;
}

/** `POST /admin/usuarios/createUser` (ADMIN): 201; 409 si el email ya está registrado. */
export async function crearUsuario(datos: DatosAltaUsuario): Promise<UsuarioAdmin> {
  const { data } = await apiClient.post<UsuarioAdmin>('/admin/usuarios/createUser', datos);
  return data;
}

/** `PATCH /admin/usuarios/{id}` (ADMIN): parcial; 404 si ya no está activo; 409 `SELF_ACTION_NOT_ALLOWED` / `LAST_ADMIN`. */
export async function actualizarUsuario(id: number, cambios: CambiosUsuario): Promise<UsuarioAdmin> {
  const { data } = await apiClient.patch<UsuarioAdmin>(`/admin/usuarios/${id}`, cambios);
  return data;
}

/** `DELETE /admin/usuarios/{id}` (ADMIN): 204, baja lógica que cierra sus sesiones; 404 si ya estaba desactivado; 409 propia cuenta / último administrador. */
export async function desactivarUsuario(id: number): Promise<void> {
  await apiClient.delete(`/admin/usuarios/${id}`);
}
