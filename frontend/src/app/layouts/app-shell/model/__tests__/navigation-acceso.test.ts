import { describe, expect, it } from 'vitest';
import { ACCESO_RUTAS, puedeAcceder, RUTAS, type Ruta } from '@/shared/config';
import { seccionesParaRoles } from '../navigation';

const COMBINACIONES: string[][] = [
  [],
  ['CLIENT'],
  ['PEDIDOS'],
  ['STOCK'],
  ['ADMIN'],
  ['CLIENT', 'PEDIDOS'],
  ['STOCK', 'PEDIDOS'],
  ['CLIENT', 'ADMIN'],
  ['COCINA'],
  ['CLIENT', 'PEDIDOS', 'STOCK', 'ADMIN'],
];

const estadoDe = (roles: string[]) => (roles.some((rol) => ['CLIENT', 'PEDIDOS', 'STOCK', 'ADMIN'].includes(rol)) ? 'autenticada' : 'anonima');

describe('navegación coherente con la tabla de acceso', () => {
  it.each(COMBINACIONES)('roles %s: cada ítem visible apunta a una ruta accesible y ninguna ruta accesible (salvo ingreso) queda sin ítem', (...roles) => {
    const estado = estadoDe(roles);
    const visibles = seccionesParaRoles(roles).flatMap((seccion) => seccion.items.map((item) => item.to));

    for (const ruta of visibles) {
      expect(puedeAcceder(ACCESO_RUTAS[ruta], estado, roles), `${ruta} visible pero no accesible`).toBe(true);
    }
    const accesibles = (Object.values(RUTAS) as Ruta[]).filter((ruta) => puedeAcceder(ACCESO_RUTAS[ruta], estado, roles));
    expect([...visibles].sort()).toEqual([...accesibles].sort());
  });
});
