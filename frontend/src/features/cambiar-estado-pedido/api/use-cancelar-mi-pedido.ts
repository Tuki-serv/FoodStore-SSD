import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelarMiPedido, type CambioEstadoPedido, type PedidoDetalle } from '@/entities/pedido';
import { politicaCachePedido } from './politica-cache';

/**
 * Cancela un pedido propio (`DELETE /pedidos/{id}`, solo `CLIENT` dueño). Recibe el mismo cuerpo que el cambio de estado
 * (`nuevo_estado` es siempre `CANCELADO`; viaja solo el `motivo`) para compartir el envío con la cancelación de gestión.
 */
export function useCancelarMiPedido(pedidoId: number) {
  const cliente = useQueryClient();
  return useMutation<PedidoDetalle, unknown, CambioEstadoPedido>({
    mutationFn: (cambio) => cancelarMiPedido(pedidoId, cambio.motivo ?? ''),
    ...politicaCachePedido(cliente, pedidoId),
  });
}
