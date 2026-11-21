import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api';
import { clasificarErrorCreacion } from '../model';

const error = (status: number | null, detail: string, code = status === null ? 'NETWORK_ERROR' : `HTTP_${status}`) =>
  new ApiError({ status, code, detail, field: null });

describe('clasificarErrorCreacion', () => {
  it.each([
    [400, 'INSUFFICIENT_STOCK', 'productos'],
    [400, 'PRODUCT_UNAVAILABLE', 'productos'],
    [404, 'PRODUCT_NOT_FOUND', 'productos'],
    [400, 'DUPLICATE_ITEM', 'productos'],
    [400, 'INVALID_CUSTOMIZATION', 'productos'],
    [400, 'PAYMENT_METHOD_UNAVAILABLE', 'forma-pago'],
    [404, 'ADDRESS_NOT_FOUND', 'entrega'],
  ] as const)('%i con code %s → %s, sin mirar el texto', (status, code, esperado) => {
    expect(clasificarErrorCreacion(error(status, 'Texto que no se mira', code))).toBe(esperado);
  });

  it('el mismo texto con otro código se clasifica por el código', () => {
    expect(clasificarErrorCreacion(error(400, 'No hay stock suficiente', 'PAYMENT_METHOD_UNAVAILABLE'))).toBe('forma-pago');
    expect(clasificarErrorCreacion(error(400, 'Forma de pago no está habilitada', 'INSUFFICIENT_STOCK'))).toBe('productos');
  });

  it('un texto conocido con un código genérico HTTP_400 ya no se reconoce: es «otro»', () => {
    expect(clasificarErrorCreacion(error(400, 'No hay stock suficiente'))).toBe('otro');
  });

  it('sin respuesta del servidor es un problema de conexión', () => {
    expect(clasificarErrorCreacion(error(null, 'No pudimos conectar con el servidor.'))).toBe('conexion');
  });

  it.each([500, 502, 503])('un %i es un problema de conexión aunque traiga un código conocido', (status) => {
    expect(clasificarErrorCreacion(error(status, 'Ocurrió un error inesperado. Probá de nuevo.'))).toBe('conexion');
    expect(clasificarErrorCreacion(error(status, 'x', 'INSUFFICIENT_STOCK'))).toBe('conexion');
  });

  it('403 es falta de permiso', () => {
    expect(clasificarErrorCreacion(error(403, 'No tenés permiso'))).toBe('sin-permiso');
  });

  it('un 400 con código desconocido es «otro»', () => {
    expect(clasificarErrorCreacion(error(400, 'Algo que el backend agregó mañana', 'CODIGO_NUEVO'))).toBe('otro');
  });

  it('un 422 es «otro»', () => {
    expect(clasificarErrorCreacion(error(422, 'Datos inválidos', 'VALIDATION_ERROR'))).toBe('otro');
  });
});
