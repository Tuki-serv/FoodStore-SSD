import { selectTotalItems, useCartStore } from '../model/cart-store';

/** Nombre accesible de un enlace al carrito: «Carrito» o «Carrito, N productos» (el número del badge es decorativo). */
export function etiquetaCarrito(unidades: number): string {
  return unidades === 0 ? 'Carrito' : `Carrito, ${unidades} ${unidades === 1 ? 'producto' : 'productos'}`;
}

/** Badge con la cantidad de unidades del carrito; sin unidades no dibuja nada. Se suscribe solo al total (no a las líneas). */
export function ContadorCarrito() {
  const unidades = useCartStore(selectTotalItems);
  if (unidades === 0) return null;
  return (
    <span className="count" aria-hidden="true">
      {unidades}
    </span>
  );
}
