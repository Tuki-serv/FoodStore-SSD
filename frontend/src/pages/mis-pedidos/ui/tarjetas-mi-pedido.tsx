import { textoPersonalizacion } from '@/entities/cart';
import { LineaEstadoPago, PagoEnConfirmacion, TraspasoPago, type EstadoPagoPedido, type VistaPagoDelPedido } from '@/entities/payment';
import { EntregaDelPedido, EtiquetaFormaPago, type PedidoDetalle } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { Icon } from '@/shared/ui';

/** Bloque de pago dentro de «Seguimiento»: pagar, reintentar o esperar la confirmación (solo un pedido `MERCADOPAGO` pendiente). */
export function BloquePago({ pedido, vista }: { pedido: Pick<PedidoDetalle, 'id' | 'total'>; vista: VistaPagoDelPedido }) {
  if (vista === 'nada') return null;
  if (vista === 'en-confirmacion') return <PagoEnConfirmacion pedidoId={pedido.id} integrado />;
  return <TraspasoPago pedidoId={pedido.id} total={formatearPrecio(pedido.total)} reintento={vista === 'reintento'} integrado />;
}

export interface TarjetaEntregaYPagoProps {
  pedido: PedidoDetalle;
  /** Último intento de pago consultado (solo `MERCADOPAGO`); `null` si no hay o todavía no llegó. */
  pago: EstadoPagoPedido | null;
}

/** «Entrega y pago»: dirección (o retiro), forma de pago, el estado del último intento con Mercado Pago y la nota del cliente. */
export function TarjetaEntregaYPago({ pedido, pago }: TarjetaEntregaYPagoProps) {
  return (
    <section className="ocard c-ent" aria-labelledby="entrega-titulo">
      <h2 id="entrega-titulo">Entrega y pago</h2>
      <dl className="kv">
        <dt>Entrega</dt>
        <dd>
          <EntregaDelPedido direccion={pedido.direccion} />
        </dd>
        <dt>Forma de pago</dt>
        <dd>
          <EtiquetaFormaPago codigo={pedido.forma_pago_codigo} />
        </dd>
        {pedido.forma_pago_codigo !== 'MERCADOPAGO' ? null : pago !== null && pago.estado !== null ? (
          <LineaEstadoPago pago={{ ...pago, estado: pago.estado }} />
        ) : (
          <>
            <dt>Pago</dt>
            <dd>
              <span className="sec-note">Todavía no pagaste este pedido.</span>
            </dd>
          </>
        )}
      </dl>
      {pedido.notas === null || pedido.notas === '' ? null : (
        <div className="cust-note">
          <Icon name="nota" />
          <div>
            <strong>Tu nota</strong>
            {pedido.notas}
          </div>
        </div>
      )}
    </section>
  );
}

/** «Productos»: ítems con sus snapshots y los totales que devolvió el servidor. */
export function TarjetaProductosMiPedido({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <section className="ocard c-prod" aria-labelledby="productos-titulo">
      <h2 id="productos-titulo">Productos</h2>
      <ul className="sum-items" aria-label="Productos del pedido">
        {pedido.items.map((item) => {
          const personalizacion = textoPersonalizacion({ personalizacion: item.personalizacion ?? [], personalizacionNombres: item.personalizacion_snapshot ?? [] });
          return (
            <li key={`${item.producto_id}:${(item.personalizacion ?? []).join(',')}`}>
              <span className="q">{item.cantidad} ×</span>
              <span className="n">
                {item.nombre_snapshot}
                {personalizacion === null ? null : <small>{personalizacion}</small>}
              </span>
              <span className="p">{formatearPrecio(item.subtotal_snapshot)}</span>
            </li>
          );
        })}
      </ul>
      <div className="totals">
        <div className="line">
          <span>Subtotal</span>
          <span>{formatearPrecio(pedido.subtotal)}</span>
        </div>
        <div className="line">
          <span>Costo de envío</span>
          <span>{formatearPrecio(pedido.costo_envio)}</span>
        </div>
        <div className="line">
          <span>Descuento</span>
          <span>{formatearPrecio(pedido.descuento)}</span>
        </div>
        <div className="total">
          <span>Total</span>
          <span>{formatearPrecio(pedido.total)}</span>
        </div>
      </div>
    </section>
  );
}
