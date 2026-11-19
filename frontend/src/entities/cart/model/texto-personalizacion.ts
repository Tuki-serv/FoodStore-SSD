import type { LineaCarrito } from './cart-store';

/**
 * Subtítulo de una línea personalizada: «Sin cebolla, sin tomate». Sin nombres guardados (línea migrada de v1) se
 * cuentan los ids («Sin 2 ingredientes»). Sin exclusiones devuelve `null`.
 */
export function textoPersonalizacion(linea: Pick<LineaCarrito, 'personalizacion' | 'personalizacionNombres'>): string | null {
  if (linea.personalizacion.length === 0) return null;
  if (linea.personalizacionNombres.length > 0) {
    return linea.personalizacionNombres.map((nombre, indice) => `${indice === 0 ? 'S' : 's'}in ${nombre.toLowerCase()}`).join(', ');
  }
  const cantidad = linea.personalizacion.length;
  return `Sin ${cantidad} ${cantidad === 1 ? 'ingrediente' : 'ingredientes'}`;
}
