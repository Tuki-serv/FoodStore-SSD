import { describe, expect, it } from 'vitest';
import { nombreDeRol, NOMBRE_ROL, ROLES } from '..';

describe('nombreDeRol', () => {
  it('cada rol conocido tiene su nombre visible', () => {
    expect(NOMBRE_ROL).toEqual({ ADMIN: 'Administrador', STOCK: 'Gestor de stock', PEDIDOS: 'Gestor de pedidos', CLIENT: 'Cliente' });
    expect(ROLES.map(nombreDeRol)).toEqual(['Administrador', 'Gestor de stock', 'Gestor de pedidos', 'Cliente']);
  });

  it('un código desconocido se muestra tal cual', () => {
    expect(nombreDeRol('COCINA')).toBe('COCINA');
  });
});
