/** Filtro de disponibilidad tal como se guarda en la URL (`?disponible=si|no`); sin parámetro, «todos». */
export type FiltroDisponible = 'todos' | 'si' | 'no';

export interface EstadoListado {
  /** Texto de búsqueda por nombre (`''` = sin búsqueda). */
  q: string;
  /** Id de la categoría filtrada, o `null`. */
  categoria: number | null;
  disponible: FiltroDisponible;
  page: number;
}

const entero = (valor: string | null): number | null => {
  const numero = Number(valor);
  return valor !== null && valor !== '' && Number.isInteger(numero) && numero >= 1 ? numero : null;
};

/** Lee `?q=&categoria=&disponible=&page=` de la URL; cualquier valor inválido vuelve al valor por defecto. */
export function leerEstadoListado(parametros: URLSearchParams): EstadoListado {
  const disponible = parametros.get('disponible');
  return {
    q: parametros.get('q') ?? '',
    categoria: entero(parametros.get('categoria')),
    disponible: disponible === 'si' || disponible === 'no' ? disponible : 'todos',
    page: entero(parametros.get('page')) ?? 1,
  };
}

/** Parámetros de URL de un estado: los valores por defecto no dejan rastro en la dirección. */
export function aParametros({ q, categoria, disponible, page }: EstadoListado): Record<string, string> {
  return {
    ...(q === '' ? {} : { q }),
    ...(categoria === null ? {} : { categoria: String(categoria) }),
    ...(disponible === 'todos' ? {} : { disponible }),
    ...(page > 1 ? { page: String(page) } : {}),
  };
}

/** Valor del filtro para la API: `true` solo disponibles, `false` solo no disponibles, `undefined` todos. */
export function disponibleDeFiltro(filtro: FiltroDisponible): boolean | undefined {
  return filtro === 'todos' ? undefined : filtro === 'si';
}
