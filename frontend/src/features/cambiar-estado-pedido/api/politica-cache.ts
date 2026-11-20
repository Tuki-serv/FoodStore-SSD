import type { QueryClient } from '@tanstack/react-query';
import { clasificarErrorCambioEstado, pedidoQueries, type PedidoDetalle } from '@/entities/pedido';
import { aApiError } from '@/shared/api';

/**
 * Política de caché común a todas las mutaciones que cambian el estado de un pedido (gestión y cancelación del cliente):
 * al terminar bien deja el detalle devuelto en la caché y vuelve a pedir el historial y los listados; si el servidor dice
 * que la transición ya no corresponde (otro actor movió el pedido), vuelve a pedir también el detalle.
 */
export function politicaCachePedido(cliente: QueryClient, pedidoId: number) {
  return {
    onSuccess: (detalle: PedidoDetalle): void => {
      cliente.setQueryData(pedidoQueries.detalle(pedidoId).queryKey, detalle);
      void cliente.invalidateQueries({
        queryKey: pedidoQueries.todas(),
        predicate: (consulta) => !(consulta.queryKey[1] === 'detalle' && consulta.queryKey[2] === pedidoId),
      });
    },
    onError: (error: unknown): void => {
      if (clasificarErrorCambioEstado(aApiError(error)) === 'transicion') void cliente.invalidateQueries({ queryKey: pedidoQueries.todas() });
    },
  };
}
