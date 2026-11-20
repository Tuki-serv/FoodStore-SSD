import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { FiltrosListadoPedidos } from '../model';
import { listarPedidos, obtenerHistorial, obtenerPedido } from './pedidos-api';

/** Consultas de pedidos: clave con el dominio primero; es privada de la sesión (no figura en `CLAVES_PUBLICAS`). */
export const pedidoQueries = {
  todas: () => ['pedidos'] as const,
  /** Listado paginado; conserva la página anterior mientras llega la siguiente (sin parpadeo al filtrar o paginar). */
  lista: (filtros: FiltrosListadoPedidos) =>
    queryOptions({
      queryKey: ['pedidos', 'lista', filtros] as const,
      queryFn: () => listarPedidos(filtros),
      placeholderData: keepPreviousData,
    }),
  historial: (id: number) =>
    queryOptions({
      queryKey: ['pedidos', 'historial', id] as const,
      queryFn: () => obtenerHistorial(id),
    }),
  detalle: (id: number) =>
    queryOptions({
      queryKey: ['pedidos', 'detalle', id] as const,
      queryFn: () => obtenerPedido(id),
    }),
};
