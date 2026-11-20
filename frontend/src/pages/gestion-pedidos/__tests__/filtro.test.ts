import { describe, expect, it } from 'vitest';
import { aParametros, leerFiltrosPedidos, MENSAJE_RANGO_INVERTIDO, validarRango, type FiltrosUrl } from '../model';

const leer = (consulta: string) => leerFiltrosPedidos(new URLSearchParams(consulta));

describe('leerFiltrosPedidos', () => {
  it('lee estado, fechas y página de la URL', () => {
    expect(leer('estado=PENDIENTE&desde=2026-11-18&page=2')).toEqual({ estado: 'PENDIENTE', desde: '2026-11-18', hasta: '', page: 2 });
  });

  it('sin parámetros todo queda en el valor por defecto', () => {
    expect(leer('')).toEqual({ estado: null, desde: '', hasta: '', page: 1 });
  });

  it.each(['ARCHIVADO', 'pendiente', ''])('un estado desconocido («%s») vuelve a «Todos»', (estado) => {
    expect(leer(`estado=${estado}`).estado).toBeNull();
  });

  it.each(['mañana', '2026-13-01', '2026-02-30', '18/11/2026'])('una fecha inválida («%s») queda vacía', (fecha) => {
    expect(leer(`desde=${fecha}&hasta=${fecha}`)).toMatchObject({ desde: '', hasta: '' });
  });

  it.each([['0', 1], ['-3', 1], ['abc', 1], ['2.5', 1], ['3', 3]])('page=%s → %i', (page, esperada) => {
    expect(leer(`page=${page}`).page).toBe(esperada);
  });
});

describe('aParametros', () => {
  it('los valores por defecto no dejan rastro en la dirección', () => {
    expect(aParametros({ estado: null, desde: '', hasta: '', page: 1 })).toEqual({});
  });

  it('incluye solo lo que se eligió', () => {
    const filtros: FiltrosUrl = { estado: 'EN_PREP', desde: '2026-11-18', hasta: '2026-11-19', page: 3 };

    expect(aParametros(filtros)).toEqual({ estado: 'EN_PREP', desde: '2026-11-18', hasta: '2026-11-19', page: '3' });
    expect(aParametros({ estado: null, desde: '', hasta: '2026-11-19', page: 1 })).toEqual({ hasta: '2026-11-19' });
  });
});

describe('validarRango', () => {
  it('«Desde» posterior a «Hasta» es un error', () => {
    expect(validarRango('2026-11-19', '2026-11-18')).toBe(MENSAJE_RANGO_INVERTIDO);
    expect(MENSAJE_RANGO_INVERTIDO).toBe('La fecha "Desde" no puede ser posterior a "Hasta"');
  });

  it.each([
    ['2026-11-18', '2026-11-19'],
    ['2026-11-19', '2026-11-19'],
    ['2026-11-19', ''],
    ['', '2026-11-18'],
    ['', ''],
  ])('%s → %s es válido', (desde, hasta) => {
    expect(validarRango(desde, hasta)).toBeNull();
  });
});
