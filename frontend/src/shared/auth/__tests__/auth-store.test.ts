import { beforeEach, describe, expect, it } from 'vitest';
import { selectEstado, selectEstaAutenticado, selectRoles, selectUsuario, useAuthStore } from '..';
import type { UsuarioSesion } from '..';

const usuarioCliente: UsuarioSesion = {
  id: 1,
  nombre: 'Ana',
  apellido: 'Gómez',
  email: 'ana@example.com',
  celular: null,
  roles: ['CLIENT'],
};

const usuarioAdmin: UsuarioSesion = { ...usuarioCliente, id: 2, nombre: 'Beto', roles: ['CLIENT', 'ADMIN'] };

const estado = () => useAuthStore.getState();

describe('authStore', () => {
  beforeEach(() => {
    estado().reset();
  });

  it('arranca verificando, sin access ni usuario', () => {
    expect(selectEstado(estado())).toBe('verificando');
    expect(estado().accessToken).toBeNull();
    expect(selectUsuario(estado())).toBeNull();
    expect(selectRoles(estado())).toEqual([]);
    expect(selectEstaAutenticado(estado())).toBe(false);
  });

  it('establecerSesion deja la sesión autenticada con los roles del usuario', () => {
    estado().establecerSesion('A1', usuarioCliente);

    expect(selectEstado(estado())).toBe('autenticada');
    expect(estado().accessToken).toBe('A1');
    expect(selectRoles(estado())).toEqual(['CLIENT']);
    expect(selectEstaAutenticado(estado())).toBe(true);
    expect(estado().motivo).toBeNull();
  });

  it('con varios roles los expone todos', () => {
    estado().establecerSesion('A2', usuarioAdmin);

    expect(selectRoles(estado())).toEqual(['CLIENT', 'ADMIN']);
  });

  it('cerrarLocal con motivo logout deja anonima sin access ni usuario', () => {
    estado().establecerSesion('A1', usuarioCliente);

    estado().cerrarLocal({ motivo: 'logout' });

    expect(selectEstado(estado())).toBe('anonima');
    expect(estado().accessToken).toBeNull();
    expect(selectUsuario(estado())).toBeNull();
    expect(estado().motivo).toBe('logout');
  });

  it('cerrarLocal sin motivo deja anonima y sin motivo', () => {
    estado().cerrarLocal();

    expect(selectEstado(estado())).toBe('anonima');
    expect(estado().motivo).toBeNull();
  });

  it('expirarSesion deja anonima con motivo expirada', () => {
    estado().establecerSesion('A1', usuarioCliente);

    estado().expirarSesion('A1');

    expect(selectEstado(estado())).toBe('anonima');
    expect(estado().accessToken).toBeNull();
    expect(selectUsuario(estado())).toBeNull();
    expect(estado().motivo).toBe('expirada');
  });

  it('tras un logout, una renovación tardía no deja access ni reabre la sesión', () => {
    estado().establecerSesion('A1', usuarioCliente);
    estado().cerrarLocal({ motivo: 'logout' });

    estado().renovarAccess('A1', 'A2');

    expect(estado().accessToken).toBeNull();
    expect(selectEstado(estado())).toBe('anonima');
    expect(estado().motivo).toBe('logout');
  });

  it('tras un logout, un vencimiento tardío no pisa el motivo logout', () => {
    estado().establecerSesion('A1', usuarioCliente);
    estado().cerrarLocal({ motivo: 'logout' });

    estado().expirarSesion('A1');

    expect(estado().motivo).toBe('logout');
    expect(selectEstado(estado())).toBe('anonima');
  });

  it('una renovación pendiente de la sesión anterior no pisa un login posterior', () => {
    estado().establecerSesion('A1', usuarioCliente);
    estado().cerrarLocal({ motivo: 'logout' });
    estado().establecerSesion('B1', usuarioAdmin);

    estado().renovarAccess('A1', 'A2');
    estado().expirarSesion('A1');

    expect(estado().accessToken).toBe('B1');
    expect(selectEstado(estado())).toBe('autenticada');
  });

  it('renovarAccess renueva el access de la sesión vigente sin tocar estado ni usuario', () => {
    estado().establecerSesion('A1', usuarioCliente);

    estado().renovarAccess('A1', 'A2');

    expect(estado().accessToken).toBe('A2');
    expect(selectEstado(estado())).toBe('autenticada');
    expect(selectUsuario(estado())).toEqual(usuarioCliente);
  });

  it('renovarAccess también renueva mientras la sesión se está verificando (rehidratación o login en curso)', () => {
    estado().establecerAccess('A1');

    estado().renovarAccess('A1', 'A2');

    expect(estado().accessToken).toBe('A2');
    expect(selectEstado(estado())).toBe('verificando');
  });

  it('establecerAccess cambia solo el access, sin tocar estado ni usuario', () => {
    estado().establecerSesion('A1', usuarioCliente);

    estado().establecerAccess('A2');

    expect(estado().accessToken).toBe('A2');
    expect(selectEstado(estado())).toBe('autenticada');
    expect(selectUsuario(estado())).toEqual(usuarioCliente);
  });

  it('establecerUsuario actualiza solo el usuario', () => {
    estado().establecerSesion('A1', usuarioCliente);

    estado().establecerUsuario({ ...usuarioCliente, nombre: 'Anita' });

    expect(selectUsuario(estado())?.nombre).toBe('Anita');
    expect(estado().accessToken).toBe('A1');
    expect(selectEstado(estado())).toBe('autenticada');
  });

  it('limpiarMotivo borra el motivo sin cambiar el estado', () => {
    estado().establecerSesion('A1', usuarioCliente);
    estado().cerrarLocal({ motivo: 'logout' });

    estado().limpiarMotivo();

    expect(estado().motivo).toBeNull();
    expect(selectEstado(estado())).toBe('anonima');
  });

  it('reset vuelve a verificando y limpia el motivo', () => {
    estado().establecerSesion('A1', usuarioCliente);
    estado().expirarSesion('A1');

    estado().reset();

    expect(selectEstado(estado())).toBe('verificando');
    expect(estado().motivo).toBeNull();
    expect(estado().accessToken).toBeNull();
  });

  it('expirarSesion ignora una sesión que no está autenticada', () => {
    estado().establecerAccess('A1');

    estado().expirarSesion('A1');

    expect(selectEstado(estado())).toBe('verificando');
    expect(estado().motivo).toBeNull();
  });

  it('el access no se escribe en localStorage ni sessionStorage', () => {
    estado().establecerSesion('A1-secreto', usuarioCliente);
    estado().establecerAccess('A2-secreto');

    const guardado = [window.localStorage, window.sessionStorage].flatMap((almacen) =>
      Array.from({ length: almacen.length }, (_, i) => `${almacen.key(i) ?? ''}=${almacen.getItem(almacen.key(i) ?? '') ?? ''}`),
    );
    expect(guardado.filter((entrada) => entrada.includes('secreto'))).toEqual([]);
  });
});
