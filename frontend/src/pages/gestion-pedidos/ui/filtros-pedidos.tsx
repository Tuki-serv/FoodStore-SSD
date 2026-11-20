import { useState } from 'react';
import { etiquetaEstado, type EstadoPedidoCodigo } from '@/entities/pedido';
import { Campo, Icon } from '@/shared/ui';
import { ESTADOS_FILTRABLES, validarRango, type FiltrosUrl } from '../model';

export interface FiltrosPedidosProps {
  filtros: FiltrosUrl;
  /** Cualquier cambio vuelve a la página 1 (lo resuelve quien usa el componente). Solo se llama con un rango válido. */
  onCambiar: (cambios: Partial<Pick<FiltrosUrl, 'estado' | 'desde' | 'hasta'>>) => void;
  onLimpiar: () => void;
}

const esEstado = (valor: string): valor is EstadoPedidoCodigo => ESTADOS_FILTRABLES.some((estado) => estado === valor);

/** Estado y rango de fechas con etiquetas visibles; un rango invertido muestra su error y no cambia el listado. */
export function FiltrosPedidos({ filtros, onCambiar, onLimpiar }: FiltrosPedidosProps) {
  // El rango escrito se anota contra el de la URL con el que se escribió: si la URL cambia (p. ej. «Limpiar filtros»), manda la URL.
  const base = `${filtros.desde}|${filtros.hasta}`;
  const [escrito, setEscrito] = useState<{ base: string; desde: string; hasta: string } | null>(null);
  const rango = escrito !== null && escrito.base === base ? escrito : { desde: filtros.desde, hasta: filtros.hasta };
  const error = validarRango(rango.desde, rango.hasta);
  const hayFiltros = filtros.estado !== null || filtros.desde !== '' || filtros.hasta !== '' || error !== null;

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string): void => {
    const siguiente = { desde: rango.desde, hasta: rango.hasta, [campo]: valor };
    setEscrito({ base, ...siguiente });
    if (validarRango(siguiente.desde, siguiente.hasta) === null) onCambiar({ [campo]: valor });
  };
  const propsError = error === null ? {} : { 'aria-invalid': true as const, 'aria-describedby': 'rango-err' };

  return (
    <form className="gp-filters" aria-label="Filtros de pedidos" onSubmit={(evento) => evento.preventDefault()}>
      <div className="gp-filters-row">
        <Campo etiqueta="Estado" className="f-estado">
          {({ id }) => (
            <select id={id} className="input" value={filtros.estado ?? ''} onChange={(evento) => onCambiar({ estado: esEstado(evento.target.value) ? evento.target.value : null })}>
              <option value="">Todos</option>
              {ESTADOS_FILTRABLES.map((estado) => (
                <option key={estado} value={estado}>
                  {etiquetaEstado(estado)}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Desde">
          {({ id }) => <input id={id} className="input" type="date" value={rango.desde} {...propsError} onChange={(evento) => cambiarFecha('desde', evento.target.value)} />}
        </Campo>
        <Campo etiqueta="Hasta">
          {({ id }) => <input id={id} className="input" type="date" value={rango.hasta} {...propsError} onChange={(evento) => cambiarFecha('hasta', evento.target.value)} />}
        </Campo>
        {hayFiltros ? (
          <button type="button" className="link-btn clear" onClick={onLimpiar}>
            Limpiar filtros
          </button>
        ) : (
          <span />
        )}
        {error === null ? null : (
          <p className="range-err" id="rango-err" role="alert">
            <Icon name="alerta" />
            {error}
          </p>
        )}
      </div>
      <p className="gp-legend">
        <Icon name="calendario" />
        Fechas según el día del servidor (UTC)
      </p>
    </form>
  );
}
