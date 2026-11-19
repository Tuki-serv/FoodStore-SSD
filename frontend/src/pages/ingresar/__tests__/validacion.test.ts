import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { avisoDeErrorIngreso, validarIngreso } from '../model';

describe('validarIngreso', () => {
  it('con todo vacío pide email y contraseña', () => {
    expect(validarIngreso({ email: '', password: '' })).toEqual({ email: 'Ingresá tu email', password: 'Ingresá tu contraseña' });
  });

  it('un email sin dominio es inválido y un email en blanco cuenta como vacío', () => {
    expect(validarIngreso({ email: 'ana@', password: 'x' })).toEqual({ email: 'Ingresá un email válido' });
    expect(validarIngreso({ email: '   ', password: 'x' })).toEqual({ email: 'Ingresá tu email' });
  });

  it('con valores válidos no hay errores (el email se mide recortado)', () => {
    expect(validarIngreso({ email: ' ana@example.com ', password: 'secreta123' })).toEqual({});
  });
});

const error = (datos: { status: number | null; code: string; detail: string; retryAfter?: number }) =>
  new ApiError({ field: null, ...datos });

describe('avisoDeErrorIngreso', () => {
  it('401: alerta de credenciales incorrectas que vacía la contraseña, sin bloqueo', () => {
    const aviso = avisoDeErrorIngreso(error({ status: 401, code: 'HTTP_401', detail: 'Credenciales incorrectas' }), 0);
    expect(aviso).toMatchObject({ tipo: 'alerta', titulo: 'Email o contraseña incorrectos.', limpiarPassword: true, bloqueoHasta: null });
  });

  it('429 con retryAfter 840: aviso de 14 minutos y bloqueo hasta ahora + 840 s', () => {
    const aviso = avisoDeErrorIngreso(error({ status: 429, code: 'RATE_LIMIT_EXCEEDED', detail: 'x', retryAfter: 840 }), 1_000);
    expect(aviso.tipo).toBe('bloqueo');
    expect(aviso.detalle).toContain('14 minutos');
    expect(aviso.bloqueoHasta).toBe(1_000 + 840_000);
    expect(aviso.limpiarPassword).toBe(false);
  });

  it('429 con retryAfter 60: usa el singular', () => {
    const aviso = avisoDeErrorIngreso(error({ status: 429, code: 'RATE_LIMIT_EXCEEDED', detail: 'x', retryAfter: 60 }), 0);
    expect(aviso.detalle).toContain('1 minuto');
    expect(aviso.detalle).not.toContain('1 minutos');
  });

  it('429 con retryAfter 61: redondea hacia arriba a 2 minutos', () => {
    expect(avisoDeErrorIngreso(error({ status: 429, code: 'RATE_LIMIT_EXCEEDED', detail: 'x', retryAfter: 61 }), 0).detalle).toContain('2 minutos');
  });

  it('429 sin retryAfter: aviso sin tiempo y sin bloqueo', () => {
    const aviso = avisoDeErrorIngreso(error({ status: 429, code: 'RATE_LIMIT_EXCEEDED', detail: 'x' }), 0);
    expect(aviso.tipo).toBe('bloqueo');
    expect(aviso.detalle).not.toMatch(/\d/);
    expect(aviso.bloqueoHasta).toBeNull();
  });

  it('sin respuesta: alerta con el detail normalizado y conserva la contraseña', () => {
    const aviso = avisoDeErrorIngreso(error({ status: null, code: 'NETWORK_ERROR', detail: 'No pudimos conectar con el servidor.' }), 0);
    expect(aviso).toMatchObject({ tipo: 'alerta', titulo: 'No pudimos conectar con el servidor.', limpiarPassword: false, bloqueoHasta: null });
  });

  it('5xx: alerta con el detail', () => {
    expect(avisoDeErrorIngreso(error({ status: 503, code: 'HTTP_503', detail: 'Servicio no disponible' }), 0).titulo).toBe('Servicio no disponible');
  });
});
