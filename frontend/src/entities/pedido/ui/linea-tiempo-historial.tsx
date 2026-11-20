import { autorEvento, claseEstado, fechaLocal, horaLocal, tituloEvento, type EventoHistorial } from '../model';

/** Motivo con el que el backend registra la fila inicial: no se repite como observación. */
const MOTIVO_CREACION = 'Pedido creado';

/**
 * Historial de un pedido como línea de tiempo (`<ol>`) en el orden del servidor: estado al que pasó, quién lo hizo,
 * fecha y hora locales y el motivo u observación. La cancelación se resalta con el color de peligro.
 */
export function LineaTiempoHistorial({ eventos }: { eventos: readonly EventoHistorial[] }) {
  return (
    <ol className="tl" aria-label="Historial del pedido">
      {eventos.map((evento) => {
        const observacion = evento.estado_desde === null || evento.motivo === null || evento.motivo === MOTIVO_CREACION ? null : evento.motivo;
        const autor = autorEvento(evento);
        return (
          <li key={evento.id} className={evento.estado_hacia === 'CANCELADO' ? 'is-cancel' : undefined}>
            <span className={`dot s-${claseEstado(evento.estado_hacia).slice(2)}`} aria-hidden="true" />
            <div className="ev">
              <strong>{tituloEvento(evento)}</strong>
              <span className="meta">
                {evento.usuario_id === null ? <span className="sys">{autor}</span> : <b>{autor}</b>}
                {` · ${fechaLocal(evento.created_at)} a las ${horaLocal(evento.created_at)}`}
              </span>
              {observacion === null ? null : <q>{observacion}</q>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
