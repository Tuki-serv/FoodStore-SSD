import { useState } from 'react';
import type { AccionPedido, EstadoPedidoCodigo } from '@/entities/pedido';
import { avisarExito } from '@/shared/model';
import { tituloAviso } from '../model';
import { DialogoCambioEstado, type PedidoParaCambio } from './dialogo-cambio-estado';
import { DialogoCancelarPedido } from './dialogo-cancelar-pedido';

export interface SolicitudCambio {
  pedido: PedidoParaCambio;
  accion: AccionPedido;
}

export interface CambioEstadoPedidoProps {
  solicitud: SolicitudCambio;
  onCerrar: () => void;
  /** El cambio se guardó (el diálogo ya avisó y se cierra); quien lo abrió decide dónde queda el foco. */
  onExito: (destino: EstadoPedidoCodigo) => void;
}

/** Diálogo que corresponde a una acción sobre un pedido; compartido por el listado y el detalle. */
export function CambioEstadoPedido({ solicitud, onCerrar, onExito }: CambioEstadoPedidoProps) {
  const { pedido, accion } = solicitud;
  const [porFaltaDeStock, setPorFaltaDeStock] = useState(false);
  const terminar = (destino: EstadoPedidoCodigo): void => {
    avisarExito(tituloAviso(pedido.id, destino), destino === 'EN_PREP' ? 'Ahora podés despacharlo cuando esté listo.' : undefined);
    onExito(destino);
  };

  if (porFaltaDeStock || accion.tipo === 'cancelar') {
    return <DialogoCancelarPedido key="cancelar" pedido={pedido} {...(porFaltaDeStock ? { motivoInicial: 'Sin stock' } : {})} onCerrar={onCerrar} onExito={() => terminar('CANCELADO')} />;
  }
  return <DialogoCambioEstado key="avance" pedido={pedido} accion={accion} onCerrar={onCerrar} onExito={() => terminar(accion.destino)} onCancelarPorStock={() => setPorFaltaDeStock(true)} />;
}
