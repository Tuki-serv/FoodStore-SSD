import { Icon } from '../icon/icon';

export interface SelectorCantidadProps {
  valor: number;
  /** La cantidad va de 1 a este valor (stock en el detalle, tope en el carrito). */
  max: number;
  onCambiar: (valor: number) => void;
  /** Nombres accesibles de los botones; cuando varias entradas conviven en la página conviene incluir el producto. */
  etiquetaRestar?: string;
  etiquetaSumar?: string;
  /** Nombre accesible del grupo (por defecto «Cantidad»). */
  etiqueta?: string;
}

/** Selector «− n +» (sin campo libre): la cantidad queda siempre entre 1 y `max`. */
export function SelectorCantidad({
  valor,
  max,
  onCambiar,
  etiquetaRestar = 'Restar una unidad',
  etiquetaSumar = 'Sumar una unidad',
  etiqueta = 'Cantidad',
}: SelectorCantidadProps) {
  return (
    <div className="qty" role="group" aria-label={etiqueta}>
      <button type="button" aria-label={etiquetaRestar} disabled={valor <= 1} onClick={() => onCambiar(valor - 1)}>
        <Icon name="menos" className="h-[18px] w-[18px]" />
      </button>
      <output aria-live="polite">{valor}</output>
      <button type="button" aria-label={etiquetaSumar} disabled={valor >= max} onClick={() => onCambiar(valor + 1)}>
        <Icon name="mas" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
