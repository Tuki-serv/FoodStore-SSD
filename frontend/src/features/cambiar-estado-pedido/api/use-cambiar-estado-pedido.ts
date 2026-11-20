import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cambiarEstadoPedido, clasificarErrorCambioEstado, pedidoQueries, type CambioEstadoPedido, type PedidoDetalle } from '@/entities/pedido';
import { aApiError } from '@/shared/api';

/**
 * Cambia el estado de un pedido. Al terminar deja el detalle devuelto en la caché y vuelve a pedir el historial y el listado;
 * si el servidor dice que la transición ya no corresponde (otro gestor movió el pedido), vuelve a pedir también el detalle.
 */
export function useCambiarEstadoPedido(pedidoId: number) {
  const cliente = useQueryClient();
  return useMutation<PedidoDetalle, unknown, CambioEstadoPedido>({
    mutationFn: (cambio) => cambiarEstadoPedido(pedidoId, cambio),
    onSuccess: (detalle) => {
      cliente.setQueryData(pedidoQueries.detalle(pedidoId).queryKey, detalle);
      void cliente.invalidateQueries({
        queryKey: pedidoQueries.todas(),
        predicate: (consulta) => !(consulta.queryKey[1] === 'detalle' && consulta.queryKey[2] === pedidoId),
      });
    },
    onError: (error) => {
      if (clasificarErrorCambioEstado(aApiError(error)) === 'transicion') void cliente.invalidateQueries({ queryKey: pedidoQueries.todas() });
    },
  });
}
