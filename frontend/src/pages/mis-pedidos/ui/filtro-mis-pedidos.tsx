import { useId } from 'react';
import { SelectorEstadoPedido, type EstadoPedidoCodigo } from '@/entities/pedido';


export interface FiltroMisPedidosProps {
  estado: EstadoPedidoCodigo | null;
  /** Cambiar el estado vuelve a la página 1 (lo resuelve quien usa el componente). */
  onCambiar: (estado: EstadoPedidoCodigo | null) => void;
  onLimpiar: () => void;
}

/** Filtro por estado de «Mis pedidos»: control segmentado con «Estado» visible y «Limpiar filtro» cuando hay uno activo. */
export function FiltroMisPedidos({ estado, onCambiar, onLimpiar }: FiltroMisPedidosProps) {
  const idEtiqueta = useId();
  return (
    <form className="gp-filters mp-filters" aria-label="Filtro de mis pedidos" onSubmit={(evento) => evento.preventDefault()}>
      <div className="gp-filters-row">
        <div className="f-estado">
          <span id={idEtiqueta} className="seg-label">
            Estado
          </span>
          <SelectorEstadoPedido idEtiqueta={idEtiqueta} valor={estado} onCambiar={onCambiar} />
        </div>
        {estado === null ? (
          <span />
        ) : (
          <button type="button" className="link-btn clear" onClick={onLimpiar}>
            Limpiar filtro
          </button>
        )}
      </div>
    </form>
  );
}
