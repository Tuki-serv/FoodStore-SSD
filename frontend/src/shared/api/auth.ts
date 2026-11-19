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

/** `UserPublic` del backend (respuesta del registro y del `PATCH /usuarios/me`): el usuario sin roles. */
export interface UsuarioPublicoDto {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
}

export interface CredencialesIngreso {
  email: string;
  password: string;
}

/** Cuerpo de `POST /auth/register`. */
export interface DatosRegistro {
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  password: string;
}

/** Cuerpo de `PATCH /usuarios/me`: siempre los tres campos (nombre y apellido nunca `null`). */
export interface DatosPerfil {
  nombre: string;
  apellido: string;
  celular: string | null;
}

/**
 * `POST /auth/login` como formulario OAuth2 (`username` = email recortado). Axios fija el `Content-Type` urlencoded al recibir
 * `URLSearchParams`; `withCredentials` deja guardada la cookie del refresh. Devuelve el access.
 */
export async function iniciarSesionRemota({ email, password }: CredencialesIngreso): Promise<string> {
  const cuerpo = new URLSearchParams({ username: email.trim(), password });
  const { data } = await apiClient.post<{ access_token: string }>('/auth/login', cuerpo);
  return data.access_token;
}

/** `POST /auth/register`: crea la cuenta de cliente; no abre sesión. */
export async function registrarUsuarioRemoto(datos: DatosRegistro): Promise<UsuarioPublicoDto> {
  const { data } = await apiClient.post<UsuarioPublicoDto>('/auth/register', datos);
  return data;
}

/** `PATCH /usuarios/me`: actualiza nombre, apellido y celular; la respuesta no trae roles. */
export async function actualizarPerfilRemoto(datos: DatosPerfil): Promise<UsuarioPublicoDto> {
  const { data } = await apiClient.patch<UsuarioPublicoDto>('/usuarios/me', datos);
  return data;
}

export async function obtenerUsuarioActual(): Promise<UsuarioSesion> {
  const { data } = await apiClient.get<UsuarioDto>('/auth/me');
  return aUsuarioSesion(data);
}

/** `POST /auth/logout`: cierra la sesión del dispositivo en el backend (idempotente). */
export async function cerrarSesionRemota(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/** `POST /auth/logout-all`: cierra todas las sesiones del usuario. Lo usa «Mi cuenta». */
export async function cerrarTodasLasSesionesRemota(): Promise<void> {
  await apiClient.post('/auth/logout-all');
}
