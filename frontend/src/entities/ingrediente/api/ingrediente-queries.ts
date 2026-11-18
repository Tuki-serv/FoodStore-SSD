import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { listarIngredientes, type ParametrosListaIngredientes } from './ingredientes-api';

/** Consultas de ingredientes: `ingredientes` es clave pública (sobrevive al cierre de sesión). */
export const ingredienteQueries = {
  lista: (params: ParametrosListaIngredientes) =>
    queryOptions({
      queryKey: ['ingredientes', 'lista', params] as const,
      queryFn: () => listarIngredientes(params),
      placeholderData: keepPreviousData,
    }),
};
