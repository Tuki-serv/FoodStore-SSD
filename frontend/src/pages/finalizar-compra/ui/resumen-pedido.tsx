import { subtotalLinea, textoPersonalizacion, type LineaCarrito } from '@/entities/cart';
import { COSTO_ENVIO, DESCUENTO, totalEstimado } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { claseBoton, Icon } from '@/shared/ui';

export interface ResumenPedidoProps {
  lineas: readonly LineaCarrito[];
  /** Subtotal del carrito (decimal con dos decimales). */
  subtotal: string;
  /** El cliente retira en el local: el envío se cobra igual mientras PA-13 siga abierta. */
  retiro: boolean;
  pendiente: boolean;
}

/** Resumen lateral del checkout: líneas, subtotal, envío, descuento y total estimado (DD-10), con el botón de confirmar. */
export function ResumenPedido({ lineas, subtotal, retiro, pendiente }: ResumenPedidoProps) {
  const unidades = lineas.reduce((total, linea) => total + linea.cantidad, 0);
  return (
    <aside className="summary" aria-labelledby="resumen-pedido-titulo">
      <h2 id="resumen-pedido-titulo">Tu pedido</h2>
      <ul className="sum-items" aria-label="Productos del pedido">
        {lineas.map((linea) => {
          const personalizacion = textoPersonalizacion(linea);
          return (
            <li key={`${linea.productoId}:${linea.personalizacion.join(',')}`}>
              <span className="q">{linea.cantidad} ×</span>
              <span className="n">
                {linea.nombre}
                {personalizacion === null ? null : <small>{personalizacion}</small>}
              </span>
              <span>{formatearPrecio(subtotalLinea(linea))}</span>
            </li>
          );
        })}
      </ul>
      <div className="line">
        <span>{`Subtotal (${unidades} ${unidades === 1 ? 'unidad' : 'unidades'})`}</span>
        <span>{formatearPrecio(subtotal)}</span>
      </div>
      <div className="line">
        <span>Costo de envío</span>
        <span>{formatearPrecio(COSTO_ENVIO)}</span>
      </div>
      {retiro ? (
        <div className="line">
          <span className="muted-tag">Tarifa fija por pedido, también con retiro</span>
        </div>
      ) : null}
      <div className="line">
        <span>Descuento</span>
        <span>{formatearPrecio(DESCUENTO)}</span>
      </div>
      <div className="total">
        <span>Total estimado</span>
        <span>{formatearPrecio(totalEstimado(subtotal))}</span>
      </div>
      <p className="sum-note">
        <Icon name="info" />
        <span>El total final lo confirma el servidor con los precios vigentes.</span>
      </p>
      <p className="sum-note">
        <Icon name="alerta" />
        <span>Verificamos el stock al crear el pedido, pero no lo reservamos: se descuenta cuando el pedido se confirma.</span>
      </p>
      <div className="sum-action">
        <button
          type="submit"
          className={`${claseBoton('primario')} w-full`}
          disabled={pendiente}
          aria-busy={pendiente}
        >
          {pendiente ? (
            <span
              className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-border border-t-text-muted motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {pendiente ? 'Creando pedido…' : 'Confirmar pedido'}
        </button>
      </div>
    </aside>
  );
}
