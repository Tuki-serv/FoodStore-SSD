import { Icon } from '@/shared/ui';

export interface SelectorCantidadProps {
  valor: number;
  /** Stock disponible: la cantidad va de 1 a este valor. */
  max: number;
  onCambiar: (valor: number) => void;
}

/** Selector «− n +» (sin campo libre): la cantidad queda siempre entre 1 y el stock. */
export function SelectorCantidad({ valor, max, onCambiar }: SelectorCantidadProps) {
  return (
    <div className="qty" role="group" aria-label="Cantidad">
      <button type="button" aria-label="Restar una unidad" disabled={valor <= 1} onClick={() => onCambiar(valor - 1)}>
        <Icon name="menos" className="h-[18px] w-[18px]" />
      </button>
      <output aria-live="polite">{valor}</output>
      <button type="button" aria-label="Sumar una unidad" disabled={valor >= max} onClick={() => onCambiar(valor + 1)}>
        <Icon name="mas" className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
