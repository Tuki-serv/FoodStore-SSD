import type { DatosRegistro } from '@/shared/api';
import { errorDeCelular, errorDeNombrePersona, esEmailValido, textoONulo } from '@/shared/lib';

/** Valores del formulario: siempre texto (`''` = vacío). `confirmacion` ya no existe en el cuerpo que se envía (DU-5). */
export interface ValoresRegistro {
  nombre: string;
  apellido: string;
  email: string;
  celular: string;
  password: string;
  confirmacion: string;
}

export type CampoRegistro = keyof ValoresRegistro;

export type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

const MINIMO_PASSWORD = 8;

/** Error de un campo (o `undefined` si es válido); `valores` aporta la contraseña con la que se compara la repetición. */
export function validarCampo(campo: CampoRegistro, valor: string, valores: ValoresRegistro): string | undefined {
  switch (campo) {
    case 'nombre':
      return errorDeNombrePersona(valor, 'Ingresá tu nombre');
    case 'apellido':
      return errorDeNombrePersona(valor, 'Ingresá tu apellido');
    case 'email':
      if (valor.trim() === '') return 'Ingresá tu email';
      return esEmailValido(valor) ? undefined : 'Ingresá un email válido';
    case 'celular':
      return errorDeCelular(valor);
    case 'password':
      if (valor === '') return 'Ingresá una contraseña';
      return valor.length < MINIMO_PASSWORD ? `Usá al menos ${MINIMO_PASSWORD} caracteres` : undefined;
    case 'confirmacion':
      return valor === valores.password ? undefined : 'Las contraseñas no coinciden';
  }
}

const CAMPOS: readonly CampoRegistro[] = ['nombre', 'apellido', 'email', 'celular', 'password', 'confirmacion'];

/** Errores de todo el formulario; vacío si no hay ninguno. */
export function validarRegistro(valores: ValoresRegistro): ErroresRegistro {
  const errores: ErroresRegistro = {};
  for (const campo of CAMPOS) {
    const error = validarCampo(campo, valores[campo], valores);
    if (error !== undefined) errores[campo] = error;
  }
  return errores;
}

/**
 * Cuerpo de `POST /auth/register`: textos recortados, celular vacío como `null`, la contraseña tal cual y sin la repetición.
 * El email solo se recorta: pasarlo a minúsculas es del backend (D7/D13).
 */
export function aDatosRegistro(valores: ValoresRegistro): DatosRegistro {
  return {
    nombre: valores.nombre.trim(),
    apellido: valores.apellido.trim(),
    email: valores.email.trim(),
    celular: textoONulo(valores.celular),
    password: valores.password,
  };
}
