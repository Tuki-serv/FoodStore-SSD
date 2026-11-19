import { Link } from 'react-router-dom';
import { formatearPrecio } from '@/entities/producto';
import { rutaPagoPedido } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

export interface TraspasoPagoProps {
  pedidoId: number;
  /** Total del pedido según el servidor (decimal). */
  total: string;
}

/** Punto de traspaso al pago con tarjeta: el formulario seguro de Mercado Pago lo implementa C-20 en la ruta de pago del pedido. */
export function TraspasoPago({ pedidoId, total }: TraspasoPagoProps) {
  return (
    <section className="pcard handoff" aria-labelledby="pago-titulo">
      <h2 id="pago-titulo">Falta el pago</h2>
      <p>
        El pedido queda pendiente hasta que Mercado Pago apruebe el pago. Vas a cargar la tarjeta en un formulario seguro: no guardamos sus datos.
      </p>
      <Link className={`${claseBoton('primario')} w-full`} to={rutaPagoPedido(pedidoId)}>
        <Icon name="tarjeta" />
        {`Pagar ${formatearPrecio(total)} con tarjeta`}
      </Link>
    </section>
  );
}
