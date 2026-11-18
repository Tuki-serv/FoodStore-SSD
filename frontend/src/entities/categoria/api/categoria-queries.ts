import { queryOptions } from '@tanstack/react-query';
import { obtenerArbolCategorias } from './categorias-api';

const CINCO_MINUTOS_MS = 5 * 60_000;

/** El árbol cambia poco: se cachea 5 minutos. `categorias` es clave pública (sobrevive al cierre de sesión). */
export const categoriaQueries = {
  arbol: () => queryOptions({ queryKey: ['categorias', 'arbol'] as const, queryFn: obtenerArbolCategorias, staleTime: CINCO_MINUTOS_MS }),
};
