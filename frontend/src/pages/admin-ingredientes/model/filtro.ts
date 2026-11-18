/** Filtro de alérgenos tal como se guarda en la URL (`?alergeno=si|no`); sin parámetro, «todos». */
export type FiltroAlergeno = 'todos' | 'si' | 'no';

export interface EstadoListado {
  filtro: FiltroAlergeno;
  page: number;
}

/** Lee `?alergeno=` y `?page=` de la URL; cualquier valor inválido vuelve al valor por defecto (todos, página 1). */
export function leerEstadoListado(parametros: URLSearchParams): EstadoListado {
  const alergeno = parametros.get('alergeno');
  const pagina = Number(parametros.get('page'));
  return {
    filtro: alergeno === 'si' || alergeno === 'no' ? alergeno : 'todos',
    page: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** Parámetros de URL de un estado: sin filtro ni página 1 no dejan rastro en la dirección. */
export function aParametros({ filtro, page }: EstadoListado): Record<string, string> {
  return { ...(filtro === 'todos' ? {} : { alergeno: filtro }), ...(page > 1 ? { page: String(page) } : {}) };
}

/** Valor del filtro para la API: `true` solo alérgenos, `false` solo no alérgenos, `null` todos. */
export function alergenoDeFiltro(filtro: FiltroAlergeno): boolean | null {
  return filtro === 'todos' ? null : filtro === 'si';
}
