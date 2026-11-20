import { fechaLocal, horaLocal } from '@/entities/pedido';

export interface PedidoParaSeguimiento {
  estado_codigo: string;
  forma_pago_codigo: string;
  /** `true` si se entrega en una dirección; `false` para el retiro en el local. */
  conEnvio: boolean;
}

/**
 * La línea «qué sigue» del seguimiento (design D6) según el estado y la forma de pago. `entregadoEn` es la fecha del evento de
 * entrega (ISO) o `null` si el historial no llegó. Un estado que no se conoce no dice nada (`null`).
 */
export function queSigue(pedido: PedidoParaSeguimiento, entregadoEn: string | null): string | null {
  switch (pedido.estado_codigo) {
    case 'PENDIENTE':
      return pedido.forma_pago_codigo === 'MERCADOPAGO' ? 'Se confirma cuando Mercado Pago aprueba el pago.' : 'El local confirma tu pedido cuando recibe el pago.';
    case 'CONFIRMADO':
      return 'El local va a empezar a prepararlo.';
    case 'EN_PREP':
      return 'Tu pedido se está preparando.';
    case 'EN_CAMINO':
      return pedido.conEnvio ? 'Tu pedido va en camino.' : 'Tu pedido está listo para retirar.';
    case 'ENTREGADO':
      return entregadoEn === null ? 'Tu pedido fue entregado.' : `Entregado el ${fechaLocal(entregadoEn).slice(0, 5)} a las ${horaLocal(entregadoEn)}.`;
    default:
      return null;
  }
}
