import { Link } from 'react-router-dom';
import { rutaPagoPedido } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

export interface TraspasoPagoProps {
  pedidoId: number;
  /** Total del pedido según el servidor, ya con formato de precio («$ 3.850»). */
  total: string;
  /** Se muestra como bloque dentro de otra tarjeta (sin título de sección propio). */
  integrado?: boolean;
  /** El último intento fue rechazado: se invita a reintentar con otra tarjeta. */
  reintento?: boolean;
}

/** Punto de traspaso al pago con tarjeta: el formulario seguro de Mercado Pago lo implementa C-20 en la ruta de pago del pedido. */
export function TraspasoPago({ pedidoId, total, reintento = false, integrado = false }: TraspasoPagoProps) {
  const Titulo = integrado ? 'strong' : 'h2';
  return (
    <section className={`${integrado ? 'pcard-in' : 'pcard'} handoff`} aria-labelledby="pago-titulo">
      <Titulo id="pago-titulo">{reintento ? 'Intentá de nuevo' : 'Falta el pago'}</Titulo>
      <p>
        {reintento ? (
          <>
            El último intento no se cobró. El pedido sigue <b>pendiente</b>: podés pagarlo con otra tarjeta.
          </>
        ) : (
          'El pedido queda pendiente hasta que Mercado Pago apruebe el pago. Vas a cargar la tarjeta en un formulario seguro: no guardamos sus datos.'
        )}
      </p>
      <Link className={`${claseBoton('primario')}${integrado ? '' : ' w-full'}`} to={rutaPagoPedido(pedidoId)}>
        <Icon name="tarjeta" />
        {reintento ? `Reintentar el pago de ${total}` : `Pagar ${total} con tarjeta`}
      </Link>
    </section>
  );
}
