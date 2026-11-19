import { useId } from 'react';

export interface FiltroStockProps {
  activo: boolean;
  onCambiar: (activo: boolean) => void;
  /** Variante de la barra: sin texto de ayuda visible (queda como descripción accesible). */
  compacto?: boolean;
}

/** Interruptor «Solo con stock»: oculta los productos agotados. */
export function FiltroStock({ activo, onCambiar, compacto = false }: FiltroStockProps) {
  const id = useId();
  return (
    <label className={compacto ? 'switch compact' : 'switch'}>
      <span>
        <span id={`${id}-nombre`}>Solo con stock</span>
        {compacto ? (
          <span className="sr-only" id={`${id}-ayuda`}>
            Oculta los productos agotados
          </span>
        ) : (
          <small id={`${id}-ayuda`}>Oculta los productos agotados</small>
        )}
      </span>
      <input type="checkbox" role="switch" aria-labelledby={`${id}-nombre`} aria-describedby={`${id}-ayuda`} checked={activo} onChange={(evento) => onCambiar(evento.target.checked)} />
    </label>
  );
}
