import { describe, expect, it } from 'vitest';
import { aParametros, leerEstadoListado } from '../model';

const leer = (consulta: string) => leerEstadoListado(new URLSearchParams(consulta));

describe('leerEstadoListado', () => {
  it('lee el rol y la página de la URL', () => {
    expect(leer('?rol=STOCK&page=2')).toEqual({ rol: 'STOCK', page: 2 });
    expect(leer('rol=ADMIN')).toEqual({ rol: 'ADMIN', page: 1 });
  });

  it('un rol desconocido (COCINA, en minúscula, vacío) se trata como «Todos»', () => {
    expect(leer('?rol=COCINA')).toEqual({ rol: null, page: 1 });
    expect(leer('?rol=stock')).toEqual({ rol: null, page: 1 });
    expect(leer('?rol=')).toEqual({ rol: null, page: 1 });
  });

  it('una página menor que 1, decimal o inválida vuelve a la 1', () => {
    expect(leer('?page=0')).toEqual({ rol: null, page: 1 });
    expect(leer('?page=-3')).toEqual({ rol: null, page: 1 });
    expect(leer('?page=1.5')).toEqual({ rol: null, page: 1 });
    expect(leer('?page=abc')).toEqual({ rol: null, page: 1 });
  });
});

describe('aParametros', () => {
  it('guarda rol y página, y no deja rastro de los valores por defecto', () => {
    expect(aParametros({ rol: 'STOCK', page: 2 })).toEqual({ rol: 'STOCK', page: '2' });
    expect(aParametros({ rol: 'PEDIDOS', page: 1 })).toEqual({ rol: 'PEDIDOS' });
    expect(aParametros({ rol: null, page: 3 })).toEqual({ page: '3' });
    expect(aParametros({ rol: null, page: 1 })).toEqual({});
  });
});
