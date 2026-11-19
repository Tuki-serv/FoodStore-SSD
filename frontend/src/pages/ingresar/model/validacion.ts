import { esEmailValido } from '@/shared/lib';

export interface ValoresIngreso {
  email: string;
  password: string;
}

export type CampoIngreso = keyof ValoresIngreso;

export type ErroresIngreso = Partial<Record<CampoIngreso, string>>;

/** Error de un campo (o `undefined` si es válido). El email se mide recortado; la contraseña, tal cual. */
export function validarCampo(campo: CampoIngreso, valor: string): string | undefined {
  if (campo === 'email') {
    if (valor.trim() === '') return 'Ingresá tu email';
    return esEmailValido(valor) ? undefined : 'Ingresá un email válido';
  }
  return valor === '' ? 'Ingresá tu contraseña' : undefined;
}

/** Errores de todo el formulario; vacío si no hay ninguno. */
export function validarIngreso(valores: ValoresIngreso): ErroresIngreso {
  const errores: ErroresIngreso = {};
  for (const campo of ['email', 'password'] as const) {
    const error = validarCampo(campo, valores[campo]);
    if (error !== undefined) errores[campo] = error;
  }
  return errores;
}
