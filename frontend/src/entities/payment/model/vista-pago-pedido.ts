import type { PedidoParaVista } from './vista-pago';

/** Qué ofrece el detalle o la confirmación de un pedido sobre su pago: pagar, reintentar, esperar la confirmación o nada. */
export type VistaPagoDelPedido = 'traspaso' | 'reintento' | 'en-confirmacion' | 'nada';

/**
 * Solo un pedido `MERCADOPAGO` `PENDIENTE` ofrece algo (design D7): sin pago en curso lleva a pagar (o a reintentar si el
 * último intento se rechazó) y con el pago `pendiente` pide esperar. Con el pago aprobado o a devolver, o mientras todavía
 * se consulta (`consultando`), no muestra nada.
 */
export function vistaPagoDelPedido(pedido: PedidoParaVista, pago: { estado: string | null } | null, { consultando = false } = {}): VistaPagoDelPedido {
  if (consultando || pedido.forma_pago_codigo !== 'MERCADOPAGO' || pedido.estado_codigo !== 'PENDIENTE') return 'nada';
  const estado = pago?.estado ?? null;
  if (estado === 'pendiente') return 'en-confirmacion';
  if (estado === 'aprobado' || estado === 'a_devolver') return 'nada';
  return estado === 'rechazado' ? 'reintento' : 'traspaso';
}
