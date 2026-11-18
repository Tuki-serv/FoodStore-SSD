/** Largo máximo del nombre de categorías e ingredientes (`max_length=100` del backend). */
export const MAXIMO_NOMBRE = 100;

/** Error de un nombre obligatorio (medido tras recortar espacios), o `undefined` si es válido. */
export function errorDeNombre(valor: string | undefined): string | undefined {
  const texto = (valor ?? '').trim();
  if (texto === '') return 'Ingresá un nombre.';
  if (texto.length > MAXIMO_NOMBRE) return `Máximo ${MAXIMO_NOMBRE} caracteres.`;
  return undefined;
}

/** Texto recortado o `null` si queda vacío (opcionales del backend). */
export function textoONulo(valor: string): string | null {
  const texto = valor.trim();
  return texto === '' ? null : texto;
}
