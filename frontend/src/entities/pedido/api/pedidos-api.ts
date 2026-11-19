import { apiClient } from '@/shared/api';
import type { PedidoCrear, PedidoDetalle } from '../model';

/** `POST /pedidos/` (solo `CLIENT`): crea el pedido `PENDIENTE` con los precios vigentes; 201 con el detalle. */
export async function crearPedido(datos: PedidoCrear): Promise<PedidoDetalle> {
  const { data } = await apiClient.post<PedidoDetalle>('/pedidos/', datos);
  return data;
}

/** `GET /pedidos/{id}`: el detalle de un pedido propio (404 si no existe o no es del cliente). */
export async function obtenerPedido(id: number): Promise<PedidoDetalle> {
  const { data } = await apiClient.get<PedidoDetalle>(`/pedidos/${id}`);
  return data;
}
