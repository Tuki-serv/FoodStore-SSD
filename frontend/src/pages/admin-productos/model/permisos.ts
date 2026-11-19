/** Qué puede hacer el usuario en «Productos y stock» (solo presentación: el servidor sigue siendo la autoridad y responde 403). */
export interface AccionesProductos {
  /** Alta, edición y baja de productos: solo `ADMIN`. */
  gestionar: boolean;
  /** Stock y disponibilidad desde la fila: `ADMIN` o `STOCK`. */
  inventario: boolean;
}

export function accionesProductos(roles: readonly string[]): AccionesProductos {
  const esAdmin = roles.includes('ADMIN');
  return { gestionar: esAdmin, inventario: esAdmin || roles.includes('STOCK') };
}
