/** Roles que la UI reconoce (contrato del backend). `COCINA` queda fuera hasta decidir PA-07. */
export const ROLES = ['ADMIN', 'STOCK', 'PEDIDOS', 'CLIENT'] as const;
export type Rol = (typeof ROLES)[number];

export function esRol(valor: string): valor is Rol {
  return ROLES.some((rol) => rol === valor);
}
