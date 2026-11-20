import { SelectorEstadoPedido, type EstadoPedidoCodigo } from '@/entities/pedido';
import { Campo } from '@/shared/ui';

export interface FiltroMisPedidosProps {
  estado: EstadoPedidoCodigo | null;
  /** Cambiar el estado vuelve a la página 1 (lo resuelve quien usa el componente). */
  onCambiar: (estado: EstadoPedidoCodigo | null) => void;
  onLimpiar: () => void;
}

/** Filtro por estado de «Mis pedidos»: «Estado» con etiqueta visible y «Limpiar filtro» cuando hay uno activo. */
export function FiltroMisPedidos({ estado, onCambiar, onLimpiar }: FiltroMisPedidosProps) {
  return (
    <form className="gp-filters mp-filters" aria-label="Filtro de mis pedidos" onSubmit={(evento) => evento.preventDefault()}>
      <div className="gp-filters-row">
        <Campo etiqueta="Estado" className="f-estado">
          {({ id }) => <SelectorEstadoPedido id={id} valor={estado} onCambiar={onCambiar} />}
        </Campo>
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
