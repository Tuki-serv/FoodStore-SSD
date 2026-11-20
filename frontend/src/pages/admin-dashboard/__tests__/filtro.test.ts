import { describe, expect, it } from 'vitest';
import { aParametros, leerPeriodo } from '../model/filtro';

const HOY = '2026-11-20';
const leer = (busqueda: string) => leerPeriodo(new URLSearchParams(busqueda), HOY);

describe('leerPeriodo', () => {
  it('sin parámetros usa los últimos 30 días por día', () => {
    expect(leer('')).toEqual({ rango: { desde: '2026-10-22', hasta: '2026-11-20' }, agrupacion: 'day' });
  });

  it('respeta desde, hasta y agrupación válidos', () => {
    expect(leer('desde=2026-11-01&hasta=2026-11-15&agrupacion=week')).toEqual({ rango: { desde: '2026-11-01', hasta: '2026-11-15' }, agrupacion: 'week' });
  });

  it('agrupación desconocida vuelve a «día» sin tocar las fechas', () => {
    expect(leer('desde=2026-11-01&hasta=2026-11-15&agrupacion=year').agrupacion).toBe('day');
    expect(leer('desde=2026-11-01&hasta=2026-11-15&agrupacion=year').rango).toEqual({ desde: '2026-11-01', hasta: '2026-11-15' });
  });

  it('una fecha inválida reemplaza el rango entero por el defecto', () => {
    expect(leer('desde=2026-02-30&hasta=2026-11-15').rango).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
    expect(leer('desde=ayer&hasta=2026-11-15').rango).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
  });

  it('un solo extremo no alcanza: se usa el defecto', () => {
    expect(leer('desde=2026-11-01').rango).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
  });

  it('un rango invertido o de más de un año que llega por URL se reemplaza por el defecto', () => {
    expect(leer('desde=2026-11-19&hasta=2026-11-18').rango).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
    expect(leer('desde=2025-01-01&hasta=2026-11-20').rango).toEqual({ desde: '2026-10-22', hasta: '2026-11-20' });
  });
});

describe('aParametros', () => {
  it('el período por defecto no deja rastro en la dirección', () => {
    expect(aParametros({ rango: { desde: '2026-10-22', hasta: '2026-11-20' }, agrupacion: 'day' }, HOY)).toEqual({});
  });

  it('un atajo distinto del defecto escribe sus fechas, y la agrupación solo si no es «día»', () => {
    expect(aParametros({ rango: { desde: '2026-11-01', hasta: '2026-11-20' }, agrupacion: 'day' }, HOY)).toEqual({ desde: '2026-11-01', hasta: '2026-11-20' });
    expect(aParametros({ rango: { desde: '2026-11-01', hasta: '2026-11-15' }, agrupacion: 'week' }, HOY)).toEqual({ desde: '2026-11-01', hasta: '2026-11-15', agrupacion: 'week' });
  });

  it('la agrupación sola también se escribe aunque el rango sea el defecto', () => {
    expect(aParametros({ rango: { desde: '2026-10-22', hasta: '2026-11-20' }, agrupacion: 'month' }, HOY)).toEqual({ agrupacion: 'month' });
  });
});
