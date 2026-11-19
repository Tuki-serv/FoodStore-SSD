import { selectTotalItems, selectTotalPrecio, useCartStore } from '@/entities/cart';
import { formatearPrecio } from '@/entities/producto';
import { Icon } from '@/shared/ui';

/** Totales del carrito. Sin botón de checkout hasta C-19 (no existe la ruta). */
export function ResumenCarrito() {
  const unidades = useCartStore(selectTotalItems);
  const total = useCartStore(selectTotalPrecio);
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
        El envío y los precios finales se confirman al crear el pedido.
      </p>
    </section>
  );
}
