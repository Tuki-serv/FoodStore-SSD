import type { Rol } from '@/shared/config';

/** Rol de un usuario tal como lo devuelve el backend (`RolPublic`). */
export interface RolDeUsuario {
  codigo: string;
  nombre: string;
}

/** Usuario activo de `GET /admin/usuarios/` (`UserPublicAdminPanel`). */
export interface UsuarioAdmin {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  roles: RolDeUsuario[];
}

/** Cuerpo de `POST /admin/usuarios/createUser` (`UserCreateAdmin`): al menos un rol. */
export interface DatosAltaUsuario {
  nombre: string;
  apellido: string;
  email: string;
  celular: string | null;
  password: string;
  roles_codigos: string[];
}

/** Cuerpo de `PATCH /admin/usuarios/{id}`: solo los campos que cambian (los roles, como la lista completa). */
export interface CambiosUsuario {
  nombre?: string;
  apellido?: string;
  celular?: string | null;
  roles_codigos?: string[];
}

/** Filtros del listado: un rol (o todos) y la página; el tamaño es fijo (`TAMANO_PAGINA_USUARIOS`). */
export interface FiltrosUsuarios {
  rol: Rol | null;
  page: number;
}

/** Usuarios por página del listado de administración. */
export const TAMANO_PAGINA_USUARIOS = 20;

/** Nombre y apellido tal como se muestran. */
export const nombreCompleto = (usuario: Pick<UsuarioAdmin, 'nombre' | 'apellido'>): string => `${usuario.nombre} ${usuario.apellido}`;
