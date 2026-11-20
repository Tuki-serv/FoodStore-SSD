import { esRol, type Rol } from '@/shared/config';

/** Estado del listado tal como se guarda en la URL (`?rol=STOCK&page=2`); sin rol, «Todos». */
export interface EstadoListado {
  rol: Rol | null;
  page: number;
}

/** Lee `?rol=` y `?page=` de la URL; un rol desconocido (p. ej. `COCINA`) o una página inválida vuelven al valor por defecto (todos, página 1). */
export function leerEstadoListado(parametros: URLSearchParams): EstadoListado {
  const rol = parametros.get('rol');
  const pagina = Number(parametros.get('page'));
  return {
    rol: rol !== null && esRol(rol) ? rol : null,
    page: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}

/** Parámetros de URL de un estado: sin rol ni página 1 no dejan rastro en la dirección. */
export function aParametros({ rol, page }: EstadoListado): Record<string, string> {
  return { ...(rol === null ? {} : { rol }), ...(page > 1 ? { page: String(page) } : {}) };
}
