import type { DatosPerfil } from '@/shared/api';
import type { UsuarioSesion } from '@/shared/auth';
import { errorDeCelular, errorDeNombrePersona, textoONulo } from '@/shared/lib';

/** Valores del formulario: siempre texto (`''` = vacío), como los entrega un `<input>`. */
export interface ValoresPerfil {
  nombre: string;
  apellido: string;
  celular: string;
}

export type CampoPerfil = keyof ValoresPerfil;

export type ErroresPerfil = Partial<Record<CampoPerfil, string>>;

/** Valores del formulario a partir del usuario de la sesión (el celular nulo se muestra vacío). */
export function valoresIniciales(usuario: UsuarioSesion): ValoresPerfil {
  return { nombre: usuario.nombre, apellido: usuario.apellido, celular: usuario.celular ?? '' };
}

/** Error de un campo (o `undefined` si es válido), medido tras recortar espacios. */
export function validarCampo(campo: CampoPerfil, valor: string): string | undefined {
  switch (campo) {
    case 'nombre':
      return errorDeNombrePersona(valor, 'Ingresá tu nombre');
    case 'apellido':
      return errorDeNombrePersona(valor, 'Ingresá tu apellido');
    case 'celular':
      return errorDeCelular(valor);
  }
}

const CAMPOS: readonly CampoPerfil[] = ['nombre', 'apellido', 'celular'];

/** Errores de todo el formulario; vacío si no hay ninguno. */
export function validarPerfil(valores: ValoresPerfil): ErroresPerfil {
  const errores: ErroresPerfil = {};
  for (const campo of CAMPOS) {
    const error = validarCampo(campo, valores[campo]);
    if (error !== undefined) errores[campo] = error;
  }
  return errores;
}

/** Cuerpo de `PATCH /usuarios/me`: siempre los tres campos, recortados; `celular` vacío como `null` y nunca `null` en nombre ni apellido. */
export function aDatosPerfil(valores: ValoresPerfil): DatosPerfil {
  return { nombre: valores.nombre.trim(), apellido: valores.apellido.trim(), celular: textoONulo(valores.celular) };
}
