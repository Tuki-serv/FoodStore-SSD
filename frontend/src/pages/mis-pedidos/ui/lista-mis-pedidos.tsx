import { Link, useLocation } from 'react-router-dom';
import { BadgeEstado, esEstadoTerminal, EtiquetaFormaPago, fechaHoraCorta, type PedidoResumen } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { rutaMiPedido } from '@/shared/config';
import { claseEntradaEscalonada, estiloEscalonado, usePrimerMontaje } from '@/shared/lib';
import { claseBoton, Icon } from '@/shared/ui';

function FilaMiPedido({ pedido, indice }: { pedido: PedidoResumen; indice: number }) {
  const { search } = useLocation();
  const destino = { to: rutaMiPedido(pedido.id), state: { volverA: search } };
  return (
    <li className="orow mrow" style={estiloEscalonado(indice)}>
      <div className="onum">
        <Link {...destino}>{`#${pedido.id}`}</Link>
        <small>
          {fechaHoraCorta(pedido.created_at)}
          {esEstadoTerminal(pedido.estado_codigo) ? null : <span className="en-curso">En curso</span>}
        </small>
      </div>
      <div className="opay">
        <EtiquetaFormaPago codigo={pedido.forma_pago_codigo} />
      </div>
      <div className="ototal">{formatearPrecio(pedido.total)}</div>
      <div className="ostate">
        <BadgeEstado codigo={pedido.estado_codigo} />
      </div>
      <div className="oact">
        <Link {...destino} className={claseBoton('fantasma', { compacto: true })} aria-label={`Ver el detalle del pedido #${pedido.id}`}>
          Ver detalle
          <Icon name="flecha" />
        </Link>
      </div>
    </li>
  );
}

export interface ListaMisPedidosProps {
  pedidos: readonly PedidoResumen[];
  /** Lo que se ve es de una página o filtro anterior mientras llegan los datos nuevos. */
  desactualizada?: boolean;
}

/** Mis pedidos: encabezado de columnas (solo desktop) y una fila por pedido; en mobile cada fila es una tarjeta. */
export function ListaMisPedidos({ pedidos, desactualizada = false }: ListaMisPedidosProps) {
  const primerMontaje = usePrimerMontaje();
  return (
    <ul className={claseEntradaEscalonada(primerMontaje, desactualizada ? 'olist is-stale' : 'olist')} aria-label="Mis pedidos">
      <li className="orow mrow ohead" aria-hidden="true">
        <span>Pedido</span>
        <span>Forma de pago</span>
        <span className="r">Total</span>
        <span>Estado</span>
        <span />
      </li>
      {pedidos.map((pedido, indice) => (
        <FilaMiPedido key={pedido.id} pedido={pedido} indice={indice} />
      ))}
    </ul>
  );
}

/** Esqueleto de la primera carga. */
export function EsqueletoMisPedidos({ filas = 5 }: { filas?: number }) {
  return (
    <div className="olist" role="status" aria-busy="true" aria-label="Cargando tus pedidos">
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="skel-orow mrow">
          <span className="skel" style={{ width: '70%' }} />
          <span className="skel" style={{ width: `${50 + ((indice * 13) % 30)}%` }} />
          <span className="skel" style={{ width: '80%' }} />
          <span className="skel p" />
          <span className="skel b" />
        </div>
      ))}
    </div>
  );
}
