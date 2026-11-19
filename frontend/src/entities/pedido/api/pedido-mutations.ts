import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PedidoCrear } from '../model';
import { pedidoQueries } from './pedido-queries';
import { crearPedido } from './pedidos-api';

/**
 * Crea el pedido. Al terminar bien siembra `pedidoQueries.detalle(id)` con la respuesta (la confirmación no pide el pedido
 * otra vez) e invalida `['pedidos']` para que el listado de C-21 se vuelva a pedir.
 */
export function useCrearPedido() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: PedidoCrear) => crearPedido(datos),
    onSuccess: async (pedido) => {
      await cliente.invalidateQueries({ queryKey: pedidoQueries.todas(), refetchType: 'none' });
      // Después de invalidar: sembrar el detalle lo deja fresco (si no, la confirmación lo volvería a pedir al montarse).
      cliente.setQueryData(pedidoQueries.detalle(pedido.id).queryKey, pedido);
    },
  });
}
