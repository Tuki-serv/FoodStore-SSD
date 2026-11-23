import { formatearPrecio } from '../model';

export interface PrecioProps {
  /** Decimal del servidor. */
  valor: string;
  /** El «$» va aparte, chico y apagado (detalle de producto); el texto completo sigue siendo «$ 1.500». */
  simboloChico?: boolean;
}

/** Precio en pesos a partir del decimal del servidor. */
export function Precio({ valor, simboloChico = false }: PrecioProps) {
  const texto = formatearPrecio(valor);
  if (!simboloChico || !texto.startsWith('$ ')) return <span className="price">{texto}</span>;
  return (
    <span className="price">
      <small>$</small> {texto.slice(2)}
    </span>
  );
}
