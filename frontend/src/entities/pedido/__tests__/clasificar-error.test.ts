import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clasificarErrorCreacion } from '../model';

const error = (status: number | null, detail: string, code = status === null ? 'NETWORK_ERROR' : `HTTP_${status}`) =>
  new ApiError({ status, code, detail, field: null });

describe('clasificarErrorCreacion', () => {
  it.each([
    [400, 'No hay stock suficiente', 'productos'],
    [400, 'Producto no disponible', 'productos'],
    [404, 'Producto no encontrado', 'productos'],
    [400, 'No puede pedir dos veces el mismo producto con la misma personalización', 'productos'],
    [400, 'Forma de pago no está habilitada', 'forma-pago'],
    [404, 'Forma de pago no encontrada', 'forma-pago'],
    [400, 'Forma de pago no encontrada', 'forma-pago'],
  ] as const)('%i «%s» → %s', (status, detail, esperado) => {
    expect(clasificarErrorCreacion(error(status, detail))).toBe(esperado);
  });

  it('sin respuesta del servidor es un problema de conexión', () => {
    expect(clasificarErrorCreacion(error(null, 'No pudimos conectar con el servidor.'))).toBe('conexion');
  });

  it.each([500, 502, 503])('un %i es un problema de conexión', (status) => {
    expect(clasificarErrorCreacion(error(status, 'Ocurrió un error inesperado. Probá de nuevo.'))).toBe('conexion');
  });

  it('403 es falta de permiso', () => {
    expect(clasificarErrorCreacion(error(403, 'No tenés permiso'))).toBe('sin-permiso');
  });

  it('un 400 con texto desconocido es «otro»', () => {
    expect(clasificarErrorCreacion(error(400, 'Algo que el backend agregó mañana'))).toBe('otro');
  });

  it('un 422 es «otro»', () => {
    expect(clasificarErrorCreacion(error(422, 'Datos inválidos', 'VALIDATION_ERROR'))).toBe('otro');
  });
});
