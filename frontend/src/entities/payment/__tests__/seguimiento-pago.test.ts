import { describe, expect, it } from 'vitest';
import { INTERVALO_SEGUIMIENTO_MS, TOPE_SEGUIMIENTO_MS, intervaloSeguimiento } from '../model/seguimiento-pago';

describe('constantes del seguimiento (OQ-2)', () => {
  it('consulta cada 5 s durante 2 min', () => {
    expect(INTERVALO_SEGUIMIENTO_MS).toBe(5000);
    expect(TOPE_SEGUIMIENTO_MS).toBe(120000);
  });
});

describe('intervaloSeguimiento', () => {
  it('con el pago pendiente y dentro del tope devuelve el intervalo', () => {
    expect(intervaloSeguimiento('pendiente', false)).toBe(5000);
  });

  it('con el pago pendiente pero agotado el tope no sigue consultando', () => {
    expect(intervaloSeguimiento('pendiente', true)).toBe(false);
  });

  it.each(['aprobado', 'rechazado', 'a_devolver', null, undefined] as const)('con el estado %s no consulta', (estado) => {
    expect(intervaloSeguimiento(estado, false)).toBe(false);
  });
});
