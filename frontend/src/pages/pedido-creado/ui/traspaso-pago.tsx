import { Link } from 'react-router-dom';
import { formatearPrecio } from '@/entities/producto';
import { rutaPagoPedido } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

export interface TraspasoPagoProps {
  pedidoId: number;
  /** Total del pedido según el servidor (decimal). */
  total: string;
  /** El último intento fue rechazado: se invita a reintentar con otra tarjeta. */
  reintento?: boolean;
}

/** Punto de traspaso al pago con tarjeta: el formulario seguro de Mercado Pago lo implementa C-20 en la ruta de pago del pedido. */
export function TraspasoPago({ pedidoId, total, reintento = false }: TraspasoPagoProps) {
  return (
    <section className="pcard handoff" aria-labelledby="pago-titulo">
      <h2 id="pago-titulo">{reintento ? 'Intentá de nuevo' : 'Falta el pago'}</h2>
      <p>
        {reintento ? (
          <>
            El último intento no se cobró. El pedido sigue <b>pendiente</b>: podés pagarlo con otra tarjeta.
          </>
        ) : (
          'El pedido queda pendiente hasta que Mercado Pago apruebe el pago. Vas a cargar la tarjeta en un formulario seguro: no guardamos sus datos.'
        )}
      </p>
      <Link className={`${claseBoton('primario')} w-full`} to={rutaPagoPedido(pedidoId)}>
        <Icon name="tarjeta" />
        {reintento ? `Reintentar el pago de ${formatearPrecio(total)}` : `Pagar ${formatearPrecio(total)} con tarjeta`}
      </Link>
    </section>
  );
}
