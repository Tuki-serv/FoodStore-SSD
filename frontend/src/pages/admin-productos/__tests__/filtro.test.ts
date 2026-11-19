import { describe, expect, it } from 'vitest';
import { aParametros, disponibleDeFiltro, leerEstadoListado } from '../model';

describe('filtros de la URL', () => {
  it('sin parámetros: todo por defecto', () => {
    expect(leerEstadoListado(new URLSearchParams(''))).toEqual({ q: '', categoria: null, disponible: 'todos', page: 1 });
  });

  it('lee q, categoria, disponible y page', () => {
    expect(leerEstadoListado(new URLSearchParams('?q=burger&categoria=4&disponible=no&page=2'))).toEqual({
      q: 'burger',
      categoria: 4,
      disponible: 'no',
      page: 2,
    });
  });

  it('los valores inválidos vuelven al valor por defecto', () => {
    expect(leerEstadoListado(new URLSearchParams('?categoria=abc&disponible=quizas&page=0'))).toEqual({
      q: '',
      categoria: null,
      disponible: 'todos',
      page: 1,
    });
    expect(leerEstadoListado(new URLSearchParams('?page=1.5')).page).toBe(1);
  });

  it('ida y vuelta: lo que se escribe se lee igual y los valores por defecto no dejan rastro', () => {
    const estado = { q: 'burger', categoria: 4, disponible: 'si' as const, page: 3 };

    expect(aParametros(estado)).toEqual({ q: 'burger', categoria: '4', disponible: 'si', page: '3' });
    expect(leerEstadoListado(new URLSearchParams(aParametros(estado)))).toEqual(estado);
    expect(aParametros({ q: '', categoria: null, disponible: 'todos', page: 1 })).toEqual({});
  });

  it('disponibleDeFiltro: si es true, no es false, todos es undefined', () => {
    expect(disponibleDeFiltro('si')).toBe(true);
    expect(disponibleDeFiltro('no')).toBe(false);
    expect(disponibleDeFiltro('todos')).toBeUndefined();
  });
});
