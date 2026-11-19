import { Link } from 'react-router-dom';
import { selectTotalItems, selectTotalPrecio, useCartStore } from '@/entities/cart';
import { COSTO_ENVIO } from '@/entities/pedido';
import { formatearPrecio } from '@/entities/producto';
import { useRolesSesion } from '@/entities/session';
import { RUTA_FINALIZAR_COMPRA } from '@/shared/config';
import { claseBoton, Icon } from '@/shared/ui';

/** Totales del carrito y salida al checkout: «Finalizar compra» para clientes; los demás roles no pueden hacer pedidos. */
export function ResumenCarrito() {
  const unidades = useCartStore(selectTotalItems);
  const total = useCartStore(selectTotalPrecio);
  const esCliente = useRolesSesion().includes('CLIENT');
  return (
    <section className="summary" aria-labelledby="resumen-titulo">
      <h2 id="resumen-titulo">Resumen</h2>
      <div className="line">
        <span>Unidades</span>
        <span>{unidades}</span>
      </div>
      <div className="total">
        <span>Total</span>
        <span>{formatearPrecio(total)}</span>
      </div>
      <p className="sum-note">
        <Icon name="alerta" />
        {`Se suma un costo de envío de ${formatearPrecio(COSTO_ENVIO)}. Los precios finales se confirman al crear el pedido.`}
      </p>
      {esCliente ? (
        <Link className={`${claseBoton('primario')} cart-cta w-full`} to={RUTA_FINALIZAR_COMPRA}>
          Finalizar compra
        </Link>
      ) : (
        <p className="cta-muted">
          <Icon name="info" />
          <span>Solo las cuentas de cliente pueden hacer pedidos.</span>
        </p>
      )}
    </section>
  );
}
