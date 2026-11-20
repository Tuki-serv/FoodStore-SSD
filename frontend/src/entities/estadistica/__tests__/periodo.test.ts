import { describe, expect, it } from 'vitest';
import { atajoDe, esFechaIso, rangoAtajo, rangoPorDefecto, rotuloPeriodo, validarRango } from '../model/periodo';

const HOY = '2026-11-20';

describe('rangoPorDefecto', () => {
  it('son los últimos 30 días contando hoy', () => {
    expect(rangoPorDefecto(HOY)).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
  });

  it('cruza el fin de año sin perder días', () => {
    expect(rangoPorDefecto('2027-01-10')).toEqual({ desde: '2026-12-12', hasta: '2027-01-10' });
  });
});

describe('rangoAtajo', () => {
  it.each([
    ['hoy', { desde: '2026-11-20', hasta: '2026-11-20' }],
    ['7d', { desde: '2026-11-14', hasta: '2026-11-20' }],
    ['30d', { desde: '2026-10-22', hasta: '2026-11-20' }],
    ['mes', { desde: '2026-11-01', hasta: '2026-11-20' }],
  ] as const)('«%s» arma el rango de la spec', (atajo, esperado) => {
    expect(rangoAtajo(atajo, HOY)).toEqual(esperado);
  });

  it('«Este mes» el día 1 es un solo día y en año bisiesto no se corre de mes', () => {
    expect(rangoAtajo('mes', '2028-03-01')).toEqual({ desde: '2028-03-01', hasta: '2028-03-01' });
    expect(rangoAtajo('7d', '2028-03-03')).toEqual({ desde: '2028-02-26', hasta: '2028-03-03' });
  });
});

describe('atajoDe', () => {
  it('reconoce el atajo que produce exactamente ese rango', () => {
    expect(atajoDe({ desde: '2026-11-14', hasta: HOY }, HOY)).toBe('7d');
    expect(atajoDe({ desde: '2026-11-01', hasta: HOY }, HOY)).toBe('mes');
  });

  it('un rango personalizado no marca ningún atajo', () => {
    expect(atajoDe({ desde: '2026-11-01', hasta: '2026-11-15' }, HOY)).toBeNull();
  });
});

describe('validarRango', () => {
  it('desde posterior a hasta es invertido', () => {
    expect(validarRango('2026-11-19', '2026-11-18')).toBe('invertido');
  });

  it('el mismo día es válido', () => {
    expect(validarRango('2026-11-18', '2026-11-18')).toBeNull();
  });

  it('366 días contados de forma inclusiva es válido y 367 es demasiado largo', () => {
    expect(validarRango('2026-01-01', '2027-01-01')).toBeNull();
    expect(validarRango('2026-01-01', '2027-01-02')).toBe('largo');
    expect(validarRango('2025-11-20', '2026-11-20')).toBeNull();
    expect(validarRango('2025-11-19', '2026-11-20')).toBe('largo');
  });

  it('el rango de la spec desde 2025-01-01 es demasiado largo', () => {
    expect(validarRango('2025-01-01', '2026-11-20')).toBe('largo');
  });
});

describe('esFechaIso', () => {
  it('acepta fechas reales y rechaza formatos o días inexistentes', () => {
    expect(esFechaIso('2026-11-20')).toBe(true);
    expect(esFechaIso('2028-02-29')).toBe(true);
    expect(esFechaIso('2026-02-29')).toBe(false);
    expect(esFechaIso('20/11/2026')).toBe(false);
    expect(esFechaIso('')).toBe(false);
  });
});

describe('rotuloPeriodo', () => {
  it('día: dd/mm', () => {
    expect(rotuloPeriodo('2026-11-10', 'day')).toBe('10/11');
    expect(rotuloPeriodo('2026-01-05', 'day')).toBe('05/01');
  });

  it('semana: «Sem. dd/mm» con el inicio de la semana', () => {
    expect(rotuloPeriodo('2026-11-09', 'week')).toBe('Sem. 09/11');
  });

  it('mes: nombre abreviado y año', () => {
    expect(rotuloPeriodo('2026-11-01', 'month')).toBe('nov 2026');
    expect(rotuloPeriodo('2027-01-01', 'month')).toBe('ene 2027');
  });
});
