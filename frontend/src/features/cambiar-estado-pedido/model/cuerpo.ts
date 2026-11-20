import type { CambioEstadoPedido, EstadoPedidoCodigo } from '@/entities/pedido';

/** Largo máximo de la observación o del motivo (el backend no lo limita; tope de la UI). */
export const MAXIMO_MOTIVO = 300;

/** Cuerpo del `PATCH /pedidos/{id}/estado`: el `motivo` viaja recortado y solo si quedó algo escrito. */
export function armarCambio(destino: EstadoPedidoCodigo, texto: string): CambioEstadoPedido {
  const motivo = texto.trim();
  return motivo === '' ? { nuevo_estado: destino } : { nuevo_estado: destino, motivo };
}

const AVISOS: Partial<Record<EstadoPedidoCodigo, string>> = {
  CONFIRMADO: 'confirmado',
  EN_PREP: 'en preparación',
  EN_CAMINO: 'en camino',
  ENTREGADO: 'entregado',
  CANCELADO: 'cancelado',
};

/** Título del aviso de éxito: «Pedido #57 en preparación». */
export function tituloAviso(pedidoId: number, destino: EstadoPedidoCodigo): string {
  return `Pedido #${pedidoId} ${AVISOS[destino] ?? 'actualizado'}`;
}
