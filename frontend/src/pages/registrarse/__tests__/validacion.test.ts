import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { aDatosRegistro, erroresDeRegistro, validarCampo, validarRegistro, type ValoresRegistro } from '../model';

const validos: ValoresRegistro = {
  nombre: 'Ana',
  apellido: 'Gómez',
  email: 'ana@example.com',
  celular: '',
  password: 'secreta123',
  confirmacion: 'secreta123',
};

describe('validarCampo', () => {
  it('contraseña de 7 caracteres: «Usá al menos 8 caracteres»; de 8 es válida', () => {
    expect(validarCampo('password', '1234567', validos)).toBe('Usá al menos 8 caracteres');
    expect(validarCampo('password', '12345678', validos)).toBeUndefined();
  });

  it('contraseña vacía pide ingresarla', () => {
    expect(validarCampo('password', '', validos)).toBe('Ingresá una contraseña');
  });

  it('«Repetir contraseña» distinta → «Las contraseñas no coinciden» e igual → sin error', () => {
    expect(validarCampo('confirmacion', 'secreta12', validos)).toBe('Las contraseñas no coinciden');
    expect(validarCampo('confirmacion', 'secreta123', validos)).toBeUndefined();
  });

  it('«Repetir contraseña» vacía con contraseña cargada no coincide', () => {
    expect(validarCampo('confirmacion', '', validos)).toBe('Las contraseñas no coinciden');
  });

  it('nombre de 81 caracteres → «Máximo 80 caracteres» y de 80 es válido', () => {
    expect(validarCampo('nombre', 'a'.repeat(81), validos)).toBe('Máximo 80 caracteres');
    expect(validarCampo('nombre', 'a'.repeat(80), validos)).toBeUndefined();
  });

  it('el largo del nombre se mide recortado', () => {
    expect(validarCampo('nombre', ` ${'a'.repeat(80)} `, validos)).toBeUndefined();
  });

  it('nombre en blanco → «Ingresá tu nombre» y apellido vacío → «Ingresá tu apellido»', () => {
    expect(validarCampo('nombre', '   ', validos)).toBe('Ingresá tu nombre');
    expect(validarCampo('apellido', '', validos)).toBe('Ingresá tu apellido');
    expect(validarCampo('apellido', 'a'.repeat(81), validos)).toBe('Máximo 80 caracteres');
  });

  it('celular de 21 caracteres es error y de 20 válido; vacío es válido (opcional)', () => {
    expect(validarCampo('celular', '1'.repeat(21), validos)).toBe('Máximo 20 caracteres');
    expect(validarCampo('celular', '1'.repeat(20), validos)).toBeUndefined();
    expect(validarCampo('celular', '', validos)).toBeUndefined();
  });

  it('email vacío o mal formado', () => {
    expect(validarCampo('email', '', validos)).toBe('Ingresá tu email');
    expect(validarCampo('email', 'ana@', validos)).toBe('Ingresá un email válido');
    expect(validarCampo('email', 'ana@example.com', validos)).toBeUndefined();
  });
});

describe('validarRegistro', () => {
  it('con todo válido no hay errores', () => {
    expect(validarRegistro(validos)).toEqual({});
  });

  it('nombre en blanco, apellido vacío y contraseñas distintas: un error por campo', () => {
    expect(validarRegistro({ ...validos, nombre: '   ', apellido: '', confirmacion: 'secreta12' })).toEqual({
      nombre: 'Ingresá tu nombre',
      apellido: 'Ingresá tu apellido',
      confirmacion: 'Las contraseñas no coinciden',
    });
  });
});

describe('aDatosRegistro', () => {
  it('recorta los textos, manda el celular vacío como null y descarta la repetición de la contraseña', () => {
    const datos = aDatosRegistro({ ...validos, nombre: ' Ana ', apellido: ' Gómez ', email: ' ana@example.com ', celular: '   ' });

    expect(datos).toEqual({ nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, password: 'secreta123' });
    expect(datos).not.toHaveProperty('confirmacion');
  });

  it('un celular con datos se manda recortado y la contraseña se manda tal cual', () => {
    const datos = aDatosRegistro({ ...validos, celular: ' 2615551234 ', password: ' con espacios ' });

    expect(datos.celular).toBe('2615551234');
    expect(datos.password).toBe(' con espacios ');
  });
});

const error = (datos: { status: number | null; code: string; detail: string; field?: string | null }) => new ApiError({ field: null, ...datos });

describe('erroresDeRegistro', () => {
  it('409 (field null) → mensaje en email con enlace a ingresar', () => {
    const errores = erroresDeRegistro(error({ status: 409, code: 'HTTP_409', detail: 'El email ya está registrado' }));
    expect(errores).toEqual({ campos: { email: 'Ya existe una cuenta con este email.' }, emailDuplicado: true });
  });

  it('422 con field de un campo del formulario → detail junto a ese campo', () => {
    const errores = erroresDeRegistro(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'Email inválido', field: 'email' }));
    expect(errores).toEqual({ campos: { email: 'Email inválido' }, emailDuplicado: false });
    expect(erroresDeRegistro(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'Falta nombre', field: 'nombre' })).campos).toEqual({ nombre: 'Falta nombre' });
  });

  it('422 con field desconocido (body) → alerta general', () => {
    const errores = erroresDeRegistro(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'Cuerpo inválido', field: 'body' }));
    expect(errores).toEqual({ campos: {}, alerta: 'Cuerpo inválido', emailDuplicado: false });
  });

  it('el campo de confirmación no existe en el backend: un field «confirmacion» va a la alerta', () => {
    expect(erroresDeRegistro(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'x', field: 'confirmacion' })).alerta).toBe('x');
  });

  it('sin respuesta → alerta con el detail', () => {
    const errores = erroresDeRegistro(error({ status: null, code: 'NETWORK_ERROR', detail: 'No pudimos conectar con el servidor.' }));
    expect(errores).toEqual({ campos: {}, alerta: 'No pudimos conectar con el servidor.', emailDuplicado: false });
  });
});
