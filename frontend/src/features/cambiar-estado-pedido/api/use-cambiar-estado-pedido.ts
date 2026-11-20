import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cambiarEstadoPedido, type CambioEstadoPedido, type PedidoDetalle } from '@/entities/pedido';
import { politicaCachePedido } from './politica-cache';

/** Cambia el estado de un pedido (`PEDIDOS`/`ADMIN`); la caché sigue la política común de `politicaCachePedido`. */
export function useCambiarEstadoPedido(pedidoId: number) {
  const cliente = useQueryClient();
  return useMutation<PedidoDetalle, unknown, CambioEstadoPedido>({
    mutationFn: (cambio) => cambiarEstadoPedido(pedidoId, cambio),
    ...politicaCachePedido(cliente, pedidoId),
  });
}
