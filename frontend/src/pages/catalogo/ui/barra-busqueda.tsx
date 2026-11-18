import { useId } from 'react';
import { Icon } from '@/shared/ui';

export interface BarraBusquedaProps {
  texto: string;
  onCambiar: (texto: string) => void;
  onBorrar: () => void;
}

/** «Buscar productos»: campo de búsqueda por nombre con botón para borrarlo. */
export function BarraBusqueda({ texto, onCambiar, onBorrar }: BarraBusquedaProps) {
  const id = useId();
  return (
    <div className="search" role="search">
      <Icon name="buscar" />
      <label className="sr-only" htmlFor={id}>
        Buscar productos
      </label>
      <input id={id} className="input" type="search" placeholder="Buscar productos" autoComplete="off" value={texto} onChange={(evento) => onCambiar(evento.target.value)} />
      {texto === '' ? null : (
        <button type="button" className="icon-btn" aria-label="Borrar búsqueda" onClick={onBorrar}>
          <Icon name="cerrar" className="h-[18px] w-[18px]" />
        </button>
      )}
    </div>
  );
}
