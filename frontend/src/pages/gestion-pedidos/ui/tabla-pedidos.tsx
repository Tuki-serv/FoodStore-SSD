import type { ReactNode } from 'react';
import type { PedidoResumen } from '@/entities/pedido';
import { claseEntradaEscalonada, usePrimerMontaje } from '@/shared/lib';
import { FilaPedido } from './fila-pedido';

export interface TablaPedidosProps {
  pedidos: readonly PedidoResumen[];
  /** Celda «Próxima acción» de cada pedido. */
  accion: (pedido: PedidoResumen) => ReactNode;
  /** Lo que se ve es de una página o filtro anterior mientras llegan los datos nuevos. */
  desactualizada?: boolean;
}

/** Listado de pedidos: encabezado de columnas (solo desktop) y una fila por pedido; en mobile cada fila es una tarjeta. */
export function TablaPedidos({ pedidos, accion, desactualizada = false }: TablaPedidosProps) {
  const primerMontaje = usePrimerMontaje();
  return (
    <ul className={claseEntradaEscalonada(primerMontaje, desactualizada ? 'olist is-stale' : 'olist')} aria-label="Pedidos">
      <li className="orow ohead" aria-hidden="true">
        <span>Pedido</span>
        <span>Estado</span>
        <span>Cliente</span>
        <span>Forma de pago</span>
        <span className="r">Total</span>
        <span className="r">Próxima acción</span>
      </li>
      {pedidos.map((pedido, indice) => (
        <FilaPedido key={pedido.id} pedido={pedido} accion={accion(pedido)} indice={indice} />
      ))}
    </ul>
  );
}

/** Esqueleto de la primera carga. */
export function EsqueletoPedidos({ filas = 6 }: { filas?: number }) {
  return (
    <div className="olist" role="status" aria-busy="true" aria-label="Cargando pedidos">
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="skel-orow">
          <span className="skel" style={{ width: '70%' }} />
          <span className="skel" style={{ width: `${50 + ((indice * 13) % 30)}%` }} />
          <span className="skel" style={{ width: '60%' }} />
          <span className="skel" style={{ width: '80%' }} />
          <span className="skel p" />
          <span className="skel b" />
        </div>
      ))}
    </div>
  );
}
