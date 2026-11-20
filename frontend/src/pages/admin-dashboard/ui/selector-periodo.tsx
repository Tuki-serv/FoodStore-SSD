import { useId, useState } from 'react';
import { atajoDe, esFechaIso, rangoAtajo, validarRango, type Agrupacion, type AtajoPeriodo, type ErrorRango } from '@/entities/estadistica';
import { Campo, Icon } from '@/shared/ui';
import type { PeriodoDashboard } from '../model';

const ATAJOS: readonly { valor: AtajoPeriodo; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7d', etiqueta: 'Últimos 7 días' },
  { valor: '30d', etiqueta: 'Últimos 30 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
];

const AGRUPACIONES: readonly { valor: Agrupacion; etiqueta: string }[] = [
  { valor: 'day', etiqueta: 'Día' },
  { valor: 'week', etiqueta: 'Semana' },
  { valor: 'month', etiqueta: 'Mes' },
];

const MENSAJES_ERROR: Readonly<Record<ErrorRango, string>> = {
  invertido: 'La fecha "Desde" no puede ser posterior a "Hasta"',
  largo: 'El período no puede superar un año',
};

/** `dd/mm/aaaa` de una fecha `YYYY-MM-DD`. */
const fechaCorta = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

export interface SelectorPeriodoProps {
  /** Último período válido (el de la URL). */
  periodo: PeriodoDashboard;
  /** Fecha de hoy en UTC, para los atajos. */
  hoy: string;
  /** Solo se llama con un período válido; un rango con error no sale de este componente. */
  onCambiar: (periodo: PeriodoDashboard) => void;
}

/** Atajos, agrupación y rango «Desde»/«Hasta» con etiquetas visibles; un rango inválido muestra su error y no cambia el período. */
export function SelectorPeriodo({ periodo, hoy, onCambiar }: SelectorPeriodoProps) {
  const idAtajos = useId();
  const idAgrupacion = useId();
  const idError = useId();
  // El rango escrito se anota contra el de la URL con el que se escribió: si la URL cambia (p. ej. un atajo), manda la URL.
  const base = `${periodo.rango.desde}|${periodo.rango.hasta}`;
  const [escrito, setEscrito] = useState<{ base: string; desde: string; hasta: string } | null>(null);
  const rango = escrito !== null && escrito.base === base ? escrito : periodo.rango;
  const completo = esFechaIso(rango.desde) && esFechaIso(rango.hasta);
  const error = completo ? validarRango(rango.desde, rango.hasta) : null;
  const atajo = error === null ? atajoDe(periodo.rango, hoy) : null;

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string): void => {
    const siguiente = { desde: rango.desde, hasta: rango.hasta, [campo]: valor };
    setEscrito({ base, ...siguiente });
    if (esFechaIso(siguiente.desde) && esFechaIso(siguiente.hasta) && validarRango(siguiente.desde, siguiente.hasta) === null) {
      onCambiar({ rango: { desde: siguiente.desde, hasta: siguiente.hasta }, agrupacion: periodo.agrupacion });
    }
  };
  const elegirAtajo = (valor: AtajoPeriodo): void => {
    setEscrito(null);
    onCambiar({ rango: rangoAtajo(valor, hoy), agrupacion: periodo.agrupacion });
  };
  const propsError = error === null ? {} : { 'aria-invalid': true as const, 'aria-describedby': idError };

  return (
    <section className="periodo" aria-label="Período">
      <div className="periodo-fila">
        <div className="grupo">
          <span className="grupo-lbl" id={idAtajos}>
            Período
          </span>
          <div className="seg seg-atajos" role="group" aria-labelledby={idAtajos}>
            {ATAJOS.map(({ valor, etiqueta }) => (
              <button key={valor} type="button" aria-pressed={atajo === valor} onClick={() => elegirAtajo(valor)}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
        <div className="grupo">
          <span className="grupo-lbl" id={idAgrupacion}>
            Agrupar por
          </span>
          <div className="seg" role="group" aria-labelledby={idAgrupacion}>
            {AGRUPACIONES.map(({ valor, etiqueta }) => (
              <button key={valor} type="button" aria-pressed={periodo.agrupacion === valor} onClick={() => onCambiar({ rango: periodo.rango, agrupacion: valor })}>
                {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="periodo-fila periodo-fechas">
        <Campo etiqueta="Desde">
          {({ id }) => (
            <div className="fecha">
              <Icon name="calendario" />
              <input id={id} className="input" type="date" value={rango.desde} {...propsError} onChange={(evento) => cambiarFecha('desde', evento.target.value)} />
            </div>
          )}
        </Campo>
        <Campo etiqueta="Hasta">
          {({ id }) => (
            <div className="fecha">
              <Icon name="calendario" />
              <input id={id} className="input" type="date" value={rango.hasta} {...propsError} onChange={(evento) => cambiarFecha('hasta', evento.target.value)} />
            </div>
          )}
        </Campo>
        <p className="utc">
          <Icon name="reloj" />
          Fechas en UTC
        </p>
      </div>
      {error === null ? null : (
        <>
          <p className="err-rango" id={idError} role="alert">
            <Icon name="alerta" />
            {MENSAJES_ERROR[error]}
          </p>
          <p className="stale-note">{`Se sigue mostrando el último período válido: ${fechaCorta(periodo.rango.desde)} al ${fechaCorta(periodo.rango.hasta)}.`}</p>
        </>
      )}
    </section>
  );
}
