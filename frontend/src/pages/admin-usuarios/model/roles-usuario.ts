import { nombreDeRol, type Rol } from '@/shared/config';

/** Qué puede hacer cada rol, en una línea (ayuda de cada casilla del formulario). */
export const DESCRIPCION_ROL: Readonly<Record<Rol, string>> = {
  ADMIN: 'Usuarios, catálogo, pedidos y métricas.',
  STOCK: 'Productos y stock.',
  PEDIDOS: 'Gestión y avance de los pedidos.',
  CLIENT: 'Compra en la tienda.',
};

/** Nombres visibles unidos con comas y «y» antes del último («Gestor de pedidos y Gestor de stock»). */
export function listaDeRoles(codigos: readonly string[]): string {
  const nombres = codigos.map(nombreDeRol);
  const ultimo = nombres[nombres.length - 1];
  if (ultimo === undefined || nombres.length === 1) return ultimo ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${ultimo}`;
}

/** Resumen de los roles que quedaron tras una edición («ahora solo Gestor de pedidos»). */
export function resumenRolesNuevos(codigos: readonly string[]): string {
  return `ahora ${codigos.length === 1 ? 'solo ' : ''}${listaDeRoles(codigos)}`;
}
