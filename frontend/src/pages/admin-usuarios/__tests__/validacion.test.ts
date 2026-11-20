import { describe, expect, it } from 'vitest';
import { aCuerpoAlta, cambiosUsuario, validarCampoUsuario, validarRolesUsuario, valoresInicialesUsuario, type ValoresUsuario } from '../model';

const carla: ValoresUsuario = { nombre: 'Carla', apellido: 'Gómez', email: 'carla@example.com', celular: '', password: '', roles: ['PEDIDOS', 'STOCK'] };

describe('validarCampoUsuario', () => {
  it('nombre y apellido vacíos piden ingresarlos; con más de 80 caracteres, el máximo', () => {
    expect(validarCampoUsuario('nombre', '   ')).toBe('Ingresá el nombre');
    expect(validarCampoUsuario('apellido', '')).toBe('Ingresá el apellido');
    expect(validarCampoUsuario('nombre', 'a'.repeat(81))).toBe('Máximo 80 caracteres');
    expect(validarCampoUsuario('nombre', ' Carla ')).toBeUndefined();
  });

  it('el email vacío o sin forma de email pide un email válido', () => {
    expect(validarCampoUsuario('email', '')).toBe('Ingresá un email válido');
    expect(validarCampoUsuario('email', 'carla@')).toBe('Ingresá un email válido');
    expect(validarCampoUsuario('email', ' carla@example.com ')).toBeUndefined();
  });

  it('el celular es opcional y admite hasta 20 caracteres', () => {
    expect(validarCampoUsuario('celular', '')).toBeUndefined();
    expect(validarCampoUsuario('celular', '1'.repeat(21))).toBe('Máximo 20 caracteres');
  });

  it('la contraseña inicial pide al menos 8 caracteres', () => {
    expect(validarCampoUsuario('password', 'abc123')).toBe('Usá al menos 8 caracteres');
    expect(validarCampoUsuario('password', '')).toBe('Usá al menos 8 caracteres');
    expect(validarCampoUsuario('password', 'claveinicial1')).toBeUndefined();
  });
});

describe('validarRolesUsuario', () => {
  it('sin roles pide elegir al menos uno', () => {
    expect(validarRolesUsuario([])).toBe('Elegí al menos un rol.');
    expect(validarRolesUsuario(['CLIENT'])).toBeUndefined();
  });
});

describe('aCuerpoAlta', () => {
  it('recorta, deja el celular vacío como null y envía los roles ordenados por código', () => {
    expect(aCuerpoAlta({ ...carla, nombre: ' Carla ', email: ' carla@example.com ', password: 'claveinicial1', roles: ['STOCK', 'PEDIDOS'] })).toEqual({
      nombre: 'Carla',
      apellido: 'Gómez',
      email: 'carla@example.com',
      celular: null,
      password: 'claveinicial1',
      roles_codigos: ['PEDIDOS', 'STOCK'],
    });
  });

  it('conserva el celular recortado y no recorta la contraseña', () => {
    const cuerpo = aCuerpoAlta({ ...carla, celular: ' 351 555-0100 ', password: ' clave 1234 ', roles: ['CLIENT'] });

    expect(cuerpo.celular).toBe('351 555-0100');
    expect(cuerpo.password).toBe(' clave 1234 ');
  });
});

describe('cambiosUsuario', () => {
  it('sin cambios (aun con espacios o roles en otro orden) no devuelve nada', () => {
    expect(cambiosUsuario(carla, { ...carla, nombre: ' Carla ', roles: ['STOCK', 'PEDIDOS'] })).toEqual({});
  });

  it('solo los campos cambiados; los roles, como la lista completa elegida', () => {
    expect(cambiosUsuario(carla, { ...carla, roles: ['PEDIDOS'] })).toEqual({ roles_codigos: ['PEDIDOS'] });
    expect(cambiosUsuario(carla, { ...carla, apellido: 'Núñez', celular: '351 555-0100' })).toEqual({ apellido: 'Núñez', celular: '351 555-0100' });
  });

  it('vaciar el celular lo envía como null', () => {
    expect(cambiosUsuario({ ...carla, celular: '351 555-0100' }, carla)).toEqual({ celular: null });
  });
});

describe('valoresInicialesUsuario', () => {
  it('el alta arranca vacía con «Cliente» marcado', () => {
    expect(valoresInicialesUsuario()).toEqual({ nombre: '', apellido: '', email: '', celular: '', password: '', roles: ['CLIENT'] });
  });

  it('la edición parte de los datos y roles del usuario, con el celular nulo como texto vacío', () => {
    const usuario = { id: 2, nombre: 'Carla', apellido: 'Gómez', email: 'carla@example.com', celular: null, roles: [{ codigo: 'PEDIDOS', nombre: 'Gestor de pedidos' }, { codigo: 'STOCK', nombre: 'Gestor de stock' }] };

    expect(valoresInicialesUsuario(usuario)).toEqual(carla);
  });
});
