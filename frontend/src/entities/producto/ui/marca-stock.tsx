import { estadoStock } from '../model';

export interface MarcaStockProps {
  stock: number;
  /** Sobre la imagen de una tarjeta (posición absoluta); en el detalle va en línea. */
  flotante?: boolean;
}

/**
 * «Agotado» (stock 0) o «Quedan N» (hasta el umbral); con más stock no muestra nada. Un único estilo de marca de stock
 * (`.stock`, neutro con un punto de color); solo cambia el texto y el tono (`out` / `low`). No usa los badges de estado de pedido.
 */
export function MarcaStock({ stock, flotante = false }: MarcaStockProps) {
  const estado = estadoStock(stock);
  if (estado === 'normal') return null;
  const flota = flotante ? ' tag' : '';
  return estado === 'agotado' ? (
    <span className={`stock out${flota}`}>Agotado</span>
  ) : (
    <span className={`stock low${flota}`}>Quedan {stock}</span>
  );
}
