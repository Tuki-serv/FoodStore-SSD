import { apiClient, type Paginado } from '@/shared/api';
import type { CambioEstadoPedido, EventoHistorial, FiltrosListadoPedidos, PedidoCrear, PedidoDetalle, PedidoResumen } from '../model';

/** `POST /pedidos/` (solo `CLIENT`): crea el pedido `PENDIENTE` con los precios vigentes; 201 con el detalle. */
export async function crearPedido(datos: PedidoCrear): Promise<PedidoDetalle> {
  const { data } = await apiClient.post<PedidoDetalle>('/pedidos/', datos);
  return data;
}

/** `GET /pedidos/`: los pedidos del alcance del rol (todos para `ADMIN`/`PEDIDOS`, los propios para `CLIENT` o con `propios`), paginados. Sin claves vacías. */
export async function listarPedidos({ propios, estado, desde, hasta, page, size }: FiltrosListadoPedidos): Promise<Paginado<PedidoResumen>> {
  const params = {
    ...(propios === undefined ? {} : { propios }),
    ...(estado === undefined ? {} : { estado }),
    ...(desde === undefined ? {} : { desde }),
    ...(hasta === undefined ? {} : { hasta }),
    page,
    size,
  };
  const { data } = await apiClient.get<Paginado<PedidoResumen>>('/pedidos/', { params });
  return data;
}

/** `GET /pedidos/{id}/historial`: el historial append-only, en orden cronológico, con el nombre de quien hizo cada cambio. */
export async function obtenerHistorial(id: number): Promise<EventoHistorial[]> {
  const { data } = await apiClient.get<EventoHistorial[]>(`/pedidos/${id}/historial`);
  return data;
}

/** `PATCH /pedidos/{id}/estado` (`ADMIN`/`PEDIDOS`): aplica una transición de la FSM; 200 con el detalle actualizado. */
export async function cambiarEstadoPedido(id: number, cambio: CambioEstadoPedido): Promise<PedidoDetalle> {
  const { data } = await apiClient.patch<PedidoDetalle>(`/pedidos/${id}/estado`, cambio);
  return data;
}

/** `DELETE /pedidos/{id}` (solo `CLIENT` dueño): cancela el pedido con el motivo dado; 200 con el detalle cancelado (409 si ya no se puede). */
export async function cancelarMiPedido(id: number, motivo: string): Promise<PedidoDetalle> {
  const { data } = await apiClient.delete<PedidoDetalle>(`/pedidos/${id}`, { data: { motivo } });
  return data;
}

/** `GET /pedidos/{id}`: el detalle de un pedido; lo ve su dueño y los gestores (`ADMIN`/`PEDIDOS`); 404 si no existe, 403 si es ajeno. */
export async function obtenerPedido(id: number): Promise<PedidoDetalle> {
  const { data } = await apiClient.get<PedidoDetalle>(`/pedidos/${id}`);
  return data;
}
