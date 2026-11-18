import { useId } from 'react';

export interface FiltroStockProps {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
}

/** Interruptor «Solo con stock»: oculta los productos agotados. */
export function FiltroStock({ activo, onCambiar }: FiltroStockProps) {
  const id = useId();
  return (
    <label className="switch">
      <span>
        <span id={`${id}-nombre`}>Solo con stock</span>
        <small id={`${id}-ayuda`}>Oculta los productos agotados</small>
      </span>
      <input type="checkbox" role="switch" aria-labelledby={`${id}-nombre`} aria-describedby={`${id}-ayuda`} checked={activo} onChange={(evento) => onCambiar(evento.target.checked)} />
    </label>
  );
}
