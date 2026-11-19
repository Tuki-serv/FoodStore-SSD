import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { listarDirecciones, type ParametrosListaDirecciones } from './direcciones-api';

/** Máximo de direcciones que el backend entrega por página: quien necesita «todas» (selector, confirmación del pedido) pide una sola. */
export const TAMANO_LISTA_COMPLETA = 100;

/** Consultas de direcciones: clave con el dominio primero; es privada de la sesión (no figura en `CLAVES_PUBLICAS`). */
export const direccionQueries = {
  todas: () => ['direcciones'] as const,
  listas: () => ['direcciones', 'lista'] as const,
  lista: (params: ParametrosListaDirecciones) =>
    queryOptions({
      queryKey: ['direcciones', 'lista', params] as const,
      queryFn: () => listarDirecciones(params),
      placeholderData: keepPreviousData,
    }),
};
