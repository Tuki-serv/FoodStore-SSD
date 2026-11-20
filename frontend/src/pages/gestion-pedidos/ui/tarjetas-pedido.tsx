import { textoPersonalizacion } from '@/entities/cart';
import { EntregaDelPedido, EtiquetaFormaPago, type PedidoDetalle } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { Icon } from '@/shared/ui';

/** Tarjeta «Cliente y entrega»: cliente, forma de pago, dirección (o retiro) y la nota del cliente si la hay. */
export function TarjetaEntrega({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <section className="ocard" aria-labelledby="entrega-titulo">
      <h2 id="entrega-titulo">Cliente y entrega</h2>
      <dl className="kv">
        <dt>Cliente</dt>
        <dd>
          <strong>{pedido.cliente_nombre}</strong>
        </dd>
        <dt>Forma de pago</dt>
        <dd>
          <EtiquetaFormaPago codigo={pedido.forma_pago_codigo} />
        </dd>
        <dt>Entrega</dt>
        <dd>
          <EntregaDelPedido direccion={pedido.direccion} />
        </dd>
      </dl>
      {pedido.notas === null || pedido.notas === '' ? null : (
        <div className="cust-note">
          <Icon name="nota" />
          <div>
            <strong>Nota del cliente</strong>
            {pedido.notas}
          </div>
        </div>
      )}
    </section>
  );
}

/** Tarjeta «Productos»: ítems con sus snapshots y los totales que devolvió el servidor. */
export function TarjetaProductos({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <section className="ocard" aria-labelledby="productos-titulo">
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
