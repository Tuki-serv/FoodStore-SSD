/** Formato mínimo de un email: algo, `@`, algo, `.`, algo, sin espacios. El backend (`EmailStr`) decide la validez final. */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `true` si el texto (recortado) tiene forma de email. */
export function esEmailValido(valor: string): boolean {
  return FORMATO_EMAIL.test(valor.trim());
}
