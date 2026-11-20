import { describe, expect, it } from 'vitest';
import type { PedidoResumen } from '@/entities/pedido';
import { aParametros, debeActualizarLista, leerFiltroMisPedidos, TAMANO_PAGINA } from '../model';

const leer = (consulta: string) => leerFiltroMisPedidos(new URLSearchParams(consulta));
const pedido = (estado_codigo: string): Pick<PedidoResumen, 'estado_codigo'> => ({ estado_codigo });

describe('leerFiltroMisPedidos', () => {
  it('lee el estado y la página de la URL', () => {
    expect(leer('estado=ENTREGADO&page=3')).toEqual({ estado: 'ENTREGADO', page: 3 });
  });

  it('sin parámetros queda en «Todos» y la página 1', () => {
    expect(leer('')).toEqual({ estado: null, page: 1 });
  });

  it.each(['DESPACHADO', 'pendiente', ''])('un estado desconocido («%s») vuelve a «Todos»', (estado) => {
    expect(leer(`estado=${estado}`).estado).toBeNull();
  });

  it.each([['abc', 1], ['0', 1], ['-2', 1], ['1.5', 1], ['', 1], ['4', 4]])('page=%s → %i', (page, esperada) => {
    expect(leer(`page=${page}`).page).toBe(esperada);
  });
});

describe('aParametros', () => {
  it('los valores por defecto no dejan rastro en la dirección', () => {
    expect(aParametros({ estado: null, page: 1 })).toEqual({});
  });

  it('incluye solo lo que se eligió', () => {
    expect(aParametros({ estado: 'CANCELADO', page: 2 })).toEqual({ estado: 'CANCELADO', page: '2' });
    expect(aParametros({ estado: 'PENDIENTE', page: 1 })).toEqual({ estado: 'PENDIENTE' });
    expect(aParametros({ estado: null, page: 3 })).toEqual({ page: '3' });
  });
});

describe('debeActualizarLista', () => {
  it('hay que actualizar si algún pedido de la página no terminó', () => {
    expect(debeActualizarLista([pedido('ENTREGADO'), pedido('EN_PREP')])).toBe(true);
    expect(debeActualizarLista([pedido('PENDIENTE')])).toBe(true);
  });

  it('no hace falta si todos terminaron (ENTREGADO o CANCELADO)', () => {
    expect(debeActualizarLista([pedido('ENTREGADO'), pedido('CANCELADO')])).toBe(false);
  });

  it('una lista vacía o todavía sin datos no se actualiza sola', () => {
    expect(debeActualizarLista([])).toBe(false);
    expect(debeActualizarLista(undefined)).toBe(false);
  });
});

it('muestra de a 10 pedidos por página', () => {
  expect(TAMANO_PAGINA).toBe(10);
});
