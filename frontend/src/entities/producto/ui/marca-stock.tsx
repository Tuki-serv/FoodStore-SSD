import { estadoStock } from '../model';

export interface MarcaStockProps {
  stock: number;
  /** Sobre la imagen de una tarjeta (posición absoluta); en el detalle va en línea. */
  flotante?: boolean;
}

/** «Agotado» (stock 0) o «Quedan N» (hasta el umbral); con más stock no muestra nada. */
export function MarcaStock({ stock, flotante = false }: MarcaStockProps) {
  const estado = estadoStock(stock);
  if (estado === 'normal') return null;
  const flota = flotante ? ' tag' : '';
  return estado === 'agotado' ? (
    <span className={`badge b-cancelado${flota}`}>Agotado</span>
  ) : (
    <span className={`badge b-pendiente${flota}`}>Quedan {stock}</span>
  );
}
