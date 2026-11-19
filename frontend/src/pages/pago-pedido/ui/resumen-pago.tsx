import { textoPersonalizacion } from '@/entities/cart';
import { BadgeEstado, type PedidoDetalle } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';

/** Resumen del pedido (según el servidor) que acompaña a la página de pago. */
export function ResumenPago({ pedido }: { pedido: PedidoDetalle }) {
  return (
    <aside className="summary" aria-labelledby="pago-resumen-titulo">
      <h2 id="pago-resumen-titulo">{`Pedido #${pedido.id}`}</h2>
      <div className="line">
        <span>Estado</span>
        <BadgeEstado codigo={pedido.estado_codigo} />
      </div>
      <ul className="sum-items" aria-label="Productos del pedido">
        {pedido.items.map((item) => {
          const personalizacion = textoPersonalizacion({
            personalizacion: item.personalizacion ?? [],
            personalizacionNombres: item.personalizacion_snapshot ?? [],
          });
          return (
            <li key={`${item.producto_id}:${(item.personalizacion ?? []).join(',')}`}>
              <span className="q">{item.cantidad} ×</span>
              <span className="n">
                {item.nombre_snapshot}
                {personalizacion === null ? null : <small>{personalizacion}</small>}
              </span>
              <span>{formatearPrecio(item.subtotal_snapshot)}</span>
            </li>
          );
        })}
      </ul>
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
    </aside>
  );
}
