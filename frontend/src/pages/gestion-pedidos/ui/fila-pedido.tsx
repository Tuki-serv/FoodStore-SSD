import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BadgeEstado, etiquetaFormaPago, fechaHoraCorta, type PedidoResumen } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { rutaGestionPedido } from '@/shared/config';
import { estiloEscalonado } from '@/shared/lib';

/** Fila de un pedido: el número abre el detalle (recordando los filtros para volver) y la última celda es la próxima acción. */
export function FilaPedido({ pedido, accion, indice = 0 }: { pedido: PedidoResumen; accion: ReactNode; indice?: number }) {
  const { search } = useLocation();
  return (
    <li className="orow" style={estiloEscalonado(indice)}>
      <div className="onum">
        <Link to={rutaGestionPedido(pedido.id)} state={{ volverA: search }}>
          {`#${pedido.id}`}
        </Link>
        <small>{fechaHoraCorta(pedido.created_at)}</small>
      </div>
      <div className="ostate">
        <BadgeEstado codigo={pedido.estado_codigo} />
      </div>
      <div className="ocli">{pedido.cliente_nombre}</div>
      <div className="opay">{etiquetaFormaPago(pedido.forma_pago_codigo)}</div>
      <div className="ototal">{formatearPrecio(pedido.total)}</div>
      <div className="oact">{accion}</div>
    </li>
  );
}
