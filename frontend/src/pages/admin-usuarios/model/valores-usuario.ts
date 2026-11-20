import type { DatosAltaUsuario, UsuarioAdmin } from '@/entities/usuario';
import { textoONulo } from '@/shared/lib';

/** Valores del formulario: texto (`''` = vacío) y los códigos de rol elegidos. */
export interface ValoresUsuario {
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  password: string;
  roles: string[];
}

/** Rol que viene marcado al crear (el spec exige al menos uno; «Cliente» es el caso común, mockup aprobado). */
const ROL_INICIAL = 'CLIENT';

/** Valores de partida: alta vacía con «Cliente» marcado, o los datos y roles del usuario a editar. */
export function valoresInicialesUsuario(usuario?: UsuarioAdmin): ValoresUsuario {
  if (usuario === undefined) return { nombre: '', apellido: '', email: '', celular: '', password: '', roles: [ROL_INICIAL] };
  return {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    celular: usuario.celular ?? '',
    password: '',
    roles: usuario.roles.map((rol) => rol.codigo),
  };
}

/** Lista de roles para el backend: sin repetidos y en orden de código (el orden de clic no cambia lo que se envía). */
export const codigosOrdenados = (roles: readonly string[]): string[] => [...new Set(roles)].sort();

/** Cuerpo del alta: recortado, celular vacío como `null`; la contraseña se envía tal cual. */
export function aCuerpoAlta(valores: ValoresUsuario): DatosAltaUsuario {
  return {
    nombre: valores.nombre.trim(),
    apellido: valores.apellido.trim(),
    email: valores.email.trim(),
    celular: textoONulo(valores.celular),
    password: valores.password,
    roles_codigos: codigosOrdenados(valores.roles),
  };
}
