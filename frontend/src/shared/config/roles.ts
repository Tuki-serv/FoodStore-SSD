/** Roles que la UI reconoce (contrato del backend). `COCINA` queda fuera hasta decidir PA-07. */
export const ROLES = ['ADMIN', 'STOCK', 'PEDIDOS', 'CLIENT'] as const;
export type Rol = (typeof ROLES)[number];

export function esRol(valor: string): valor is Rol {
  return ROLES.some((rol) => rol === valor);
}

/** Nombre visible de cada rol (la sesión solo guarda los códigos). */
export const NOMBRE_ROL: Readonly<Record<Rol, string>> = {
  ADMIN: 'Administrador',
  STOCK: 'Gestor de stock',
  PEDIDOS: 'Gestor de pedidos',
  CLIENT: 'Cliente',
};

/** Nombre visible de un código de rol; si no se conoce, el propio código. */
export function nombreDeRol(codigo: string): string {
  return esRol(codigo) ? NOMBRE_ROL[codigo] : codigo;
}
