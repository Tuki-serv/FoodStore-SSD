import { describe, expect, it } from 'vitest';
import { listaDeRoles, resumenRolesNuevos } from '../model';

describe('listaDeRoles', () => {
  it('nombra los roles con su nombre visible, unidos con comas y «y» antes del último', () => {
    expect(listaDeRoles(['CLIENT'])).toBe('Cliente');
    expect(listaDeRoles(['PEDIDOS', 'STOCK'])).toBe('Gestor de pedidos y Gestor de stock');
    expect(listaDeRoles(['ADMIN', 'PEDIDOS', 'STOCK'])).toBe('Administrador, Gestor de pedidos y Gestor de stock');
  });
});

describe('resumenRolesNuevos', () => {
  it('con un solo rol aclara «solo»; con varios, los lista', () => {
    expect(resumenRolesNuevos(['PEDIDOS'])).toBe('ahora solo Gestor de pedidos');
    expect(resumenRolesNuevos(['PEDIDOS', 'STOCK'])).toBe('ahora Gestor de pedidos y Gestor de stock');
  });
});
