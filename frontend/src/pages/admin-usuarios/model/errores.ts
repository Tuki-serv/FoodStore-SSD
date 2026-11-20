import type { ApiError } from '@/shared/api';
import type { CampoUsuario } from './validacion';

/** Operación que falló: decide el texto de las protecciones de la propia cuenta y qué significa un 409. */
export type OperacionUsuario = 'alta' | 'edicion' | 'baja';

/** Qué muestra la pantalla tras un fallo de `/admin/usuarios` (design D9). */
export type ErrorUsuario =
  | { tipo: 'campo'; campo: CampoUsuario; mensaje: string }
  | { tipo: 'general'; mensaje: string }
  | { tipo: 'conexion'; mensaje: string }
  | { tipo: 'ya-no-activo' };

export const MENSAJE_EMAIL_REPETIDO = 'Ya existe un usuario con ese email.';
export const MENSAJE_ULTIMO_ADMIN = 'Tiene que quedar al menos un administrador activo.';
const MENSAJE_PROPIO_ROL = 'No podés quitarte tu propio rol de administrador.';
const MENSAJE_PROPIA_BAJA = 'No podés desactivar tu propia cuenta.';

/** Campo del formulario que corresponde a un `field` del servidor (`roles_codigos` es el grupo de casillas «Roles»). */
const CAMPOS_DEL_SERVIDOR: Readonly<Record<string, CampoUsuario>> = {
  nombre: 'nombre',
  apellido: 'apellido',
  email: 'email',
  celular: 'celular',
  password: 'password',
  roles_codigos: 'roles',
};

/** Traduce el `ApiError` de una operación sobre usuarios; decide por `status`/`code`/`field`, nunca por el texto de `detail`. */
export function clasificarErrorUsuario(error: ApiError, operacion: OperacionUsuario): ErrorUsuario {
  if (error.status === null) return { tipo: 'conexion', mensaje: error.detail };
  if (error.status === 404 && operacion !== 'alta') return { tipo: 'ya-no-activo' };
  if (error.code === 'SELF_ACTION_NOT_ALLOWED') return { tipo: 'general', mensaje: operacion === 'baja' ? MENSAJE_PROPIA_BAJA : MENSAJE_PROPIO_ROL };
  if (error.code === 'LAST_ADMIN') return { tipo: 'general', mensaje: MENSAJE_ULTIMO_ADMIN };
  // El 409 del alta llega con `field: null` (C-14): es el email repetido, el único conflicto posible.
  if (error.status === 409 && operacion === 'alta') return { tipo: 'campo', campo: 'email', mensaje: MENSAJE_EMAIL_REPETIDO };
  const campo = error.status === 422 && error.field !== null ? CAMPOS_DEL_SERVIDOR[error.field] : undefined;
  if (campo !== undefined) return { tipo: 'campo', campo, mensaje: error.detail };
  return { tipo: 'general', mensaje: error.detail };
}
