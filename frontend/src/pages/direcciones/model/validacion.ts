import type { Direccion, DireccionDatos } from '@/entities/direccion';

/** Valores del formulario: siempre texto (`''` = vacío), como los entrega un `<input>`. */
export interface ValoresFormulario {
  alias: string;
  linea1: string;
  linea2: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
}

export type CampoDireccion = keyof ValoresFormulario;

export type ErroresDireccion = Partial<Record<CampoDireccion, string>>;

/** Largos máximos del backend (`DireccionCreate`); `linea2` es TEXT y no tiene límite. */
const MAXIMOS: Partial<Record<CampoDireccion, number>> = { alias: 50, ciudad: 100, provincia: 100, codigo_postal: 10 };

const OBLIGATORIOS: Partial<Record<CampoDireccion, string>> = {
  linea1: 'Ingresá la calle y el número',
  ciudad: 'Ingresá la ciudad',
};

/** Error de un campo (o `undefined` si es válido), medido tras recortar espacios. Sin formato de código postal (OQ-3). */
export function validarCampo(campo: CampoDireccion, valor: string): string | undefined {
  const texto = valor.trim();
  const obligatorio = OBLIGATORIOS[campo];
  if (obligatorio !== undefined && texto === '') return obligatorio;
  const maximo = MAXIMOS[campo];
  if (maximo !== undefined && texto.length > maximo) return `Máximo ${maximo} caracteres`;
  return undefined;
}

const CAMPOS: readonly CampoDireccion[] = ['alias', 'linea1', 'linea2', 'ciudad', 'provincia', 'codigo_postal'];

/** Errores de todo el formulario; vacío si no hay ninguno. */
export function validarDireccion(valores: ValoresFormulario): ErroresDireccion {
  const errores: ErroresDireccion = {};
  for (const campo of CAMPOS) {
    const error = validarCampo(campo, valores[campo]);
    if (error !== undefined) errores[campo] = error;
  }
  return errores;
}

/** Texto recortado o `null` si queda vacío (opcionales del backend). */
function opcional(valor: string): string | null {
  const texto = valor.trim();
  return texto === '' ? null : texto;
}

/** Cuerpo para el backend: recortado, opcionales vacíos como `null`, `linea1`/`ciudad` siempre `string`. */
export function aDireccionDatos(valores: ValoresFormulario): DireccionDatos {
  return {
    alias: opcional(valores.alias),
    linea1: valores.linea1.trim(),
    linea2: opcional(valores.linea2),
    ciudad: valores.ciudad.trim(),
    provincia: opcional(valores.provincia),
    codigo_postal: opcional(valores.codigo_postal),
  };
}

/** Valores de partida del formulario: vacíos (alta) o los de la dirección (edición). */
export function valoresIniciales(direccion?: Direccion): ValoresFormulario {
  return {
    alias: direccion?.alias ?? '',
    linea1: direccion?.linea1 ?? '',
    linea2: direccion?.linea2 ?? '',
    ciudad: direccion?.ciudad ?? '',
    provincia: direccion?.provincia ?? '',
    codigo_postal: direccion?.codigo_postal ?? '',
  };
}
