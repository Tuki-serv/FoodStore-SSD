/** Orden en que se elige el rol que se muestra en el pie del panel. */
const PRIORIDAD_ROL_PRINCIPAL = ['ADMIN', 'PEDIDOS', 'STOCK', 'CLIENT'] as const;

/** Rol principal de la sesión: el primero presente en `ADMIN`, `PEDIDOS`, `STOCK`, `CLIENT`; si ninguno, el primero recibido. */
export function rolPrincipal(roles: readonly string[]): string {
  return PRIORIDAD_ROL_PRINCIPAL.find((rol) => roles.includes(rol)) ?? roles[0] ?? '';
}
