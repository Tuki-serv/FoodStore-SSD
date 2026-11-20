import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clasificarErrorCambioEstado } from '../model';

const error = (status: number | null, code: string, field: string | null = null) =>
  new ApiError({ status, code, detail: 'cualquier texto', field });

describe('clasificarErrorCambioEstado', () => {
  it.each([
    [409, 'INSUFFICIENT_STOCK', null, 'sin-stock'],
    [409, 'INVALID_TRANSITION', null, 'transicion'],
    [422, 'VALIDATION_ERROR', 'motivo', 'motivo'],
    [403, 'HTTP_403', null, 'sin-permiso'],
    [404, 'HTTP_404', null, 'no-existe'],
    [null, 'NETWORK_ERROR', null, 'conexion'],
    [500, 'HTTP_500', null, 'conexion'],
    [503, 'HTTP_503', null, 'conexion'],
    [400, 'HTTP_400', null, 'otro'],
    [422, 'VALIDATION_ERROR', 'nuevo_estado', 'otro'],
    [409, 'OTRO_CODIGO', null, 'otro'],
  ] as const)('%s %s (campo %s) → %s', (status, code, field, esperado) => {
    expect(clasificarErrorCambioEstado(error(status, code, field))).toBe(esperado);
  });

  it('decide por el code, no por el texto del detail', () => {
    const conTextoDeStock = new ApiError({ status: 409, code: 'INVALID_TRANSITION', detail: 'No hay stock suficiente', field: null });
    expect(clasificarErrorCambioEstado(conTextoDeStock)).toBe('transicion');
  });
});
