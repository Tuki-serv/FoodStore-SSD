export type VistaPago = 'aprobado' | 'a-devolver' | 'pendiente' | 'no-tarjeta' | 'no-pagable' | 'rechazado' | 'formulario';

export interface PedidoParaVista {
  forma_pago_codigo: string;
  estado_codigo: string;
}

/**
 * Qué muestra la página de pago a partir del pedido y del último resultado conocido. El orden de las ramas es la
 * precedencia (design D4): el resultado del pago manda sobre la forma de pago y el estado del pedido.
 */
export function vistaPago(pedido: PedidoParaVista, pago: { estado: string | null } | null): VistaPago {
  const estado = pago?.estado ?? null;
  if (estado === 'aprobado') return 'aprobado';
  if (estado === 'a_devolver') return 'a-devolver';
  if (estado === 'pendiente') return 'pendiente';
  if (pedido.forma_pago_codigo !== 'MERCADOPAGO') return 'no-tarjeta';
  if (pedido.estado_codigo !== 'PENDIENTE') return 'no-pagable';
  return estado === 'rechazado' ? 'rechazado' : 'formulario';
}
