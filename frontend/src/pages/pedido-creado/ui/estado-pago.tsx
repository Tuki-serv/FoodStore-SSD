import { Link } from 'react-router-dom';
import { motivoRechazo, type EstadoPagoPedido } from '@/entities/payment';
import { rutaPagoPedido } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

const TEXTO_LINEA: Readonly<Record<NonNullable<EstadoPagoPedido['estado']>, string>> = {
  pendiente: 'Pago en confirmación',
  aprobado: 'Pago aprobado',
  rechazado: 'Último intento de pago: rechazado',
  a_devolver: 'Pago aprobado, a devolver',
};

/** Fila «Pago» del detalle (US-026): estado del último intento con su motivo legible si fue rechazado. */
export function LineaEstadoPago({ pago }: { pago: EstadoPagoPedido & { estado: NonNullable<EstadoPagoPedido['estado']> } }) {
  return (
    <>
      <dt>Pago</dt>
      <dd>
        <div className="pay-line">
          <strong>{TEXTO_LINEA[pago.estado]}</strong>
          {pago.estado === 'rechazado' ? (
            <span className="reason-inline">
              <Icon name="alerta" />
              {motivoRechazo(pago.mp_status_detail)}
            </span>
          ) : null}
          {pago.estado === 'pendiente' ? <span className="sec-note">Mercado Pago todavía no confirmó el pago. Seguilo desde la página de pago.</span> : null}
          {pago.estado === 'a_devolver' ? <span className="sec-note">Algún producto se quedó sin stock: el pedido se canceló y te devolvemos el dinero.</span> : null}
        </div>
      </dd>
    </>
  );
}

/** Pago `pendiente`: no se ofrece pagar de nuevo; se lleva a la página de pago, que sigue el estado. */
export function PagoEnConfirmacion({ pedidoId }: { pedidoId: number }) {
  return (
    <section className="pcard" aria-labelledby="pago-confirmacion-titulo">
      <h2 id="pago-confirmacion-titulo">Pago en confirmación</h2>
      <p>No lo pagues de nuevo: si Mercado Pago aprueba el pago, el pedido se confirma solo.</p>
      <div>
        <Link className={claseBoton('secundario')} to={rutaPagoPedido(pedidoId)}>
          <Icon name="reloj" />
          Ver el estado del pago
        </Link>
      </div>
    </section>
  );
}
