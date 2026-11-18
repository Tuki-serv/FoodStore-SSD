/** Unidad de medida de `GET /unidades-medida/` (`UnidadMedidaRead`). */
export interface UnidadMedida {
  id: number;
  nombre: string;
  simbolo: string;
  tipo: string;
}

/** Cómo se muestra una unidad en listas y selectores: «Gramo (g)». */
export function etiquetaUnidad({ nombre, simbolo }: Pick<UnidadMedida, 'nombre' | 'simbolo'>): string {
  return `${nombre} (${simbolo})`;
}
