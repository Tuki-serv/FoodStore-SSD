import { useState } from 'react';
import { ESTADOS_PEDIDO, etiquetaEstado } from '@/entities/pedido';
import { useMediaQuery } from '@/shared/lib';
import { claseBoton, Dialogo, Icon } from '@/shared/ui';
import { validarRango, type FiltrosUrl } from '../model';

export interface FiltrosPedidosProps {
  filtros: FiltrosUrl;
  /** Cualquier cambio vuelve a la página 1 (lo resuelve quien usa el componente). Solo se llama con un rango válido. */
  onCambiar: (cambios: Partial<Pick<FiltrosUrl, 'estado' | 'desde' | 'hasta'>>) => void;
}

/** Desde este ancho el rango va en la barra; debajo, un chip «Fechas» abre una hoja con el rango (mockup gestion-pedidos). */
const CONSULTA_DESKTOP = '(min-width: 1024px)';

/** Estado como control segmentado y rango de fechas «desde – hasta» en una fila; un rango invertido muestra su error y no cambia el listado. */
export function FiltrosPedidos({ filtros, onCambiar }: FiltrosPedidosProps) {
  // El rango escrito se anota contra el de la URL con el que se escribió: si la URL cambia (p. ej. «Limpiar filtros»), manda la URL.
  const base = `${filtros.desde}|${filtros.hasta}`;
  const [escrito, setEscrito] = useState<{ base: string; desde: string; hasta: string } | null>(null);
  const rango = escrito !== null && escrito.base === base ? escrito : { desde: filtros.desde, hasta: filtros.hasta };
  const error = validarRango(rango.desde, rango.hasta);
  const esDesktop = useMediaQuery(CONSULTA_DESKTOP);
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const fechasAplicadas = (filtros.desde === '' ? 0 : 1) + (filtros.hasta === '' ? 0 : 1);

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string): void => {
    const siguiente = { desde: rango.desde, hasta: rango.hasta, [campo]: valor };
    setEscrito({ base, ...siguiente });
    if (validarRango(siguiente.desde, siguiente.hasta) === null) onCambiar({ [campo]: valor });
  };
  const propsError = error === null ? {} : { 'aria-invalid': true as const, 'aria-describedby': 'rango-err' };

  const campos = (
    <div className="gp-range">
      <div className="field">
        <label className={esDesktop ? 'sr-only' : 'label'} htmlFor="gp-desde">
          Desde
        </label>
        <input id="gp-desde" className="input" type="date" value={rango.desde} {...propsError} onChange={(evento) => cambiarFecha('desde', evento.target.value)} />
      </div>
      <span className="sep" aria-hidden="true">
        –
      </span>
      <div className="field">
        <label className={esDesktop ? 'sr-only' : 'label'} htmlFor="gp-hasta">
          Hasta
        </label>
        <input id="gp-hasta" className="input" type="date" value={rango.hasta} {...propsError} onChange={(evento) => cambiarFecha('hasta', evento.target.value)} />
      </div>
    </div>
  );
  const avisoError =
    error === null ? null : (
      <p className="range-err" id="rango-err" role="alert">
        <Icon name="alerta" />
        {error}
      </p>
    );

  return (
    <form className="gp-filters" aria-label="Filtros de pedidos" onSubmit={(evento) => evento.preventDefault()}>
      <div className="gp-filters-row">
        <div className="gp-seg" role="group" aria-label="Estado">
          <button type="button" aria-pressed={filtros.estado === null} onClick={() => onCambiar({ estado: null })}>
            Todos
          </button>
          {ESTADOS_PEDIDO.map((estado) => (
            <button key={estado} type="button" aria-pressed={filtros.estado === estado} onClick={() => onCambiar({ estado })}>
              {etiquetaEstado(estado)}
            </button>
          ))}
        </div>
        {esDesktop ? (
          campos
        ) : (
          <button type="button" className="chip gp-fechas" aria-haspopup="dialog" onClick={() => setHojaAbierta(true)}>
            <Icon name="calendario" />
            Fechas
            {fechasAplicadas > 0 ? (
              <>
                {' '}
                <span className="count" aria-label={`${fechasAplicadas} aplicadas`}>
                  {fechasAplicadas}
                </span>
              </>
            ) : null}
          </button>
        )}
      </div>
      {esDesktop ? avisoError : null}
      {!esDesktop && hojaAbierta ? (
        <Dialogo
          titulo="Fechas"
          desplazable
          onCerrar={() => setHojaAbierta(false)}
          pie={
            <button type="button" className={`${claseBoton('primario')} grow`} onClick={() => setHojaAbierta(false)}>
              Listo
            </button>
          }
        >
          <p className="hint">Fechas según el día del servidor (UTC).</p>
          {campos}
          {avisoError}
        </Dialogo>
      ) : null}
    </form>
  );
}
