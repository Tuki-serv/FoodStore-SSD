/** Largos máximos del backend para los datos de una persona (`UserCreate` / `UserUpdateClient`). */
const MAXIMO_NOMBRE_PERSONA = 80;
const MAXIMO_CELULAR = 20;

/** Error de un nombre o apellido obligatorio (medido tras recortar espacios), o `undefined` si es válido. */
export function errorDeNombrePersona(valor: string, mensajeVacio: string): string | undefined {
  const texto = valor.trim();
  if (texto === '') return mensajeVacio;
  return texto.length > MAXIMO_NOMBRE_PERSONA ? `Máximo ${MAXIMO_NOMBRE_PERSONA} caracteres` : undefined;
}

/** Error del celular (opcional: vacío es válido), medido tras recortar espacios, o `undefined` si es válido. */
export function errorDeCelular(valor: string): string | undefined {
  return valor.trim().length > MAXIMO_CELULAR ? `Máximo ${MAXIMO_CELULAR} caracteres` : undefined;
}
