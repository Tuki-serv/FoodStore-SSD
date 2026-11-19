import { queryOptions } from '@tanstack/react-query';
import { obtenerPedido } from './pedidos-api';

/** Consultas de pedidos: clave con el dominio primero; es privada de la sesión (no figura en `CLAVES_PUBLICAS`). */
export const pedidoQueries = {
  todas: () => ['pedidos'] as const,
  detalle: (id: number) =>
    queryOptions({
      queryKey: ['pedidos', 'detalle', id] as const,
      queryFn: () => obtenerPedido(id),
    }),
};
