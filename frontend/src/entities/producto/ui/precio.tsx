import { formatearPrecio } from '../model';

/** Precio en pesos a partir del decimal del servidor. */
export function Precio({ valor }: { valor: string }) {
  return <span className="price">{formatearPrecio(valor)}</span>;
}
