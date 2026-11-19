import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clasificarErrorPago } from '../model/clasificar-error-pago';

const error = (status: number | null) => new ApiError({ status, code: status === null ? 'NETWORK_ERROR' : `HTTP_${status}`, detail: 'x', field: null });

describe('clasificarErrorPago', () => {
  it.each([
    [409, 'no-permitido'],
    [400, 'rechazado-datos'],
    [502, 'desconocido'],
    [503, 'no-disponible'],
    [404, 'no-encontrado'],
    [403, 'no-encontrado'],
    [null, 'conexion'],
    [500, 'conexion'],
  ] as const)('status %s -> %s', (status, clase) => {
    expect(clasificarErrorPago(error(status))).toBe(clase);
  });

  it('un 4xx no previsto cae en conexion (mensaje genérico)', () => {
    expect(clasificarErrorPago(error(418))).toBe('conexion');
  });
});
