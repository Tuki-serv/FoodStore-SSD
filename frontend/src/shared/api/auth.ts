import type { UsuarioSesion } from '@/shared/auth';
import { apiClient } from './http-client';

export { renovarAccess } from './renovar-access';

/** `UserPublicAdminPanel` del backend (`GET /auth/me`). */
interface UsuarioDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  roles: { codigo: string; nombre: string }[];
}

/** DTO → usuario de la sesión: los roles de la interfaz son solo los `codigo` (el access no se decodifica nunca). */
export function aUsuarioSesion({ roles, ...datos }: UsuarioDto): UsuarioSesion {
  return { ...datos, roles: roles.map(({ codigo }) => codigo) };
}

export async function obtenerUsuarioActual(): Promise<UsuarioSesion> {
  const { data } = await apiClient.get<UsuarioDto>('/auth/me');
  return aUsuarioSesion(data);
}

/** `POST /auth/logout`: cierra la sesión del dispositivo en el backend (idempotente). */
export async function cerrarSesionRemota(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/** `POST /auth/logout-all`: cierra todas las sesiones del usuario. El botón es de C-14. */
export async function cerrarTodasLasSesionesRemota(): Promise<void> {
  await apiClient.post('/auth/logout-all');
}
