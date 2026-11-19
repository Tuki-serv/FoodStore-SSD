import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import type { UsuarioSesion } from '@/shared/auth';
import { aDatosPerfil, erroresDePerfil, validarCampo, validarPerfil, valoresIniciales } from '../model';

const usuario: UsuarioSesion = { id: 1, nombre: 'Ana', apellido: 'Gómez', email: 'ana@example.com', celular: null, roles: ['CLIENT'] };

describe('valoresIniciales', () => {
  it('toma los datos de la sesión y muestra el celular nulo como vacío', () => {
    expect(valoresIniciales(usuario)).toEqual({ nombre: 'Ana', apellido: 'Gómez', celular: '' });
    expect(valoresIniciales({ ...usuario, celular: '2615551234' }).celular).toBe('2615551234');
  });
});

describe('validarCampo', () => {
  it('apellido vacío → «Ingresá tu apellido» y nombre en blanco → «Ingresá tu nombre»', () => {
    expect(validarCampo('apellido', '')).toBe('Ingresá tu apellido');
    expect(validarCampo('nombre', '   ')).toBe('Ingresá tu nombre');
  });

  it('nombre de 81 → máximo 80; de 80 válido', () => {
    expect(validarCampo('nombre', 'a'.repeat(81))).toBe('Máximo 80 caracteres');
    expect(validarCampo('nombre', 'a'.repeat(80))).toBeUndefined();
  });

  it('celular de 21 → error; de 20 y vacío son válidos', () => {
    expect(validarCampo('celular', '1'.repeat(21))).toBe('Máximo 20 caracteres');
    expect(validarCampo('celular', '1'.repeat(20))).toBeUndefined();
    expect(validarCampo('celular', '')).toBeUndefined();
  });
});

describe('validarPerfil', () => {
  it('con datos válidos no hay errores y con apellido vacío solo falla el apellido', () => {
    expect(validarPerfil({ nombre: 'Ana', apellido: 'Gómez', celular: '' })).toEqual({});
    expect(validarPerfil({ nombre: 'Ana', apellido: '', celular: '' })).toEqual({ apellido: 'Ingresá tu apellido' });
  });
});

describe('aDatosPerfil', () => {
  it('recorta, manda el celular vacío como null y siempre incluye los tres campos', () => {
    expect(aDatosPerfil({ nombre: ' Analía ', apellido: 'Gómez', celular: '  ' })).toEqual({ nombre: 'Analía', apellido: 'Gómez', celular: null });
    expect(aDatosPerfil({ nombre: 'Ana', apellido: 'Gómez', celular: ' 2615551234 ' }).celular).toBe('2615551234');
  });
});

const error = (datos: { status: number | null; code: string; detail: string; field?: string | null }) => new ApiError({ field: null, ...datos });

describe('erroresDePerfil', () => {
  it('422 con field de un campo → detail junto al campo', () => {
    expect(erroresDePerfil(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'Celular inválido', field: 'celular' }))).toEqual({ campos: { celular: 'Celular inválido' } });
  });

  it('422 con field que no es del formulario o 503 → alerta con el detail', () => {
    expect(erroresDePerfil(error({ status: 422, code: 'VALIDATION_ERROR', detail: 'Cuerpo inválido', field: 'body' }))).toEqual({ campos: {}, alerta: 'Cuerpo inválido' });
    expect(erroresDePerfil(error({ status: 503, code: 'HTTP_503', detail: 'Servicio no disponible' }))).toEqual({ campos: {}, alerta: 'Servicio no disponible' });
  });
});
