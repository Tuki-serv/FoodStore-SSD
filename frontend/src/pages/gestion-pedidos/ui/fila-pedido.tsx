import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BadgeEstado, EtiquetaFormaPago, fechaHoraCorta, type PedidoResumen } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { rutaGestionPedido } from '@/shared/config';

/** Fila de un pedido: el número abre el detalle (recordando los filtros para volver) y la última celda es la próxima acción. */
export function FilaPedido({ pedido, accion }: { pedido: PedidoResumen; accion: ReactNode }) {
  const { search } = useLocation();
  return (
    <li className="orow">
      <div className="onum">
        <Link to={rutaGestionPedido(pedido.id)} state={{ volverA: search }}>
          {`#${pedido.id}`}
        </Link>
        <small>{fechaHoraCorta(pedido.created_at)}</small>
      </div>
      <div className="ocli">{pedido.cliente_nombre}</div>
      <div className="opay">
        <EtiquetaFormaPago codigo={pedido.forma_pago_codigo} />
      </div>
      <div className="ototal">{formatearPrecio(pedido.total)}</div>
      <div className="ostate">
        <BadgeEstado codigo={pedido.estado_codigo} />
      </div>
      <div className="oact">{accion}</div>
    </li>
  );
}
