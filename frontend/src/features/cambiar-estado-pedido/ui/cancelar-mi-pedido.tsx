import { avisarExito } from '@/shared/model';
import { tituloAviso } from '../model';
import type { PedidoParaCambio } from './dialogo-cambio-estado';
import { DialogoCancelarPedido } from './dialogo-cancelar-pedido';

export interface CancelarMiPedidoProps {
  pedido: PedidoParaCambio;
  /** Cierra el diálogo sin cancelar (o tras un rechazo definitivo); quien lo abrió decide dónde queda el foco. */
  onCerrar: () => void;
  /** El pedido se canceló (el aviso de éxito ya se mostró); quien lo abrió cierra el diálogo y decide dónde queda el foco. */
  onCancelado: () => void;
}

/** Aviso que amplía el toast de éxito: solo cuando hay algo que decirle al cliente sobre su pago. */
function detalleDeExito(pedido: PedidoParaCambio): string | undefined {
  if (pedido.estado_codigo === 'PENDIENTE') return 'No se te va a cobrar nada.';
  return pedido.forma_pago_codigo === 'MERCADOPAGO' ? 'El reintegro lo gestionás con el local.' : undefined;
}

/**
 * Diálogo «Cancelar el pedido #N» del cliente dueño (`DELETE /pedidos/{id}`) con motivo obligatorio y aviso de éxito. Lo abre
 * y lo cierra quien lo usa: tiene que seguir montado aunque el pedido ya no se pueda cancelar (409), para mostrar el rechazo.
 */
export function CancelarMiPedido({ pedido, onCerrar, onCancelado }: CancelarMiPedidoProps) {
  return (
    <DialogoCancelarPedido
      pedido={pedido}
      destinatario="cliente"
      onCerrar={onCerrar}
      onExito={() => {
        avisarExito(tituloAviso(pedido.id, 'CANCELADO'), detalleDeExito(pedido));
        onCancelado();
      }}
    />
  );
}
