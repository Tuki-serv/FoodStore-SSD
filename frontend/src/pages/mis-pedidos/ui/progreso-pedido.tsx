import { fechaLocal, horaLocal, pasosProgreso, type EventoHistorial, type PedidoDetalle } from '@/entities/pedido';
import { Icon } from '@/shared/ui';
import { queSigue } from '../model';

/** El último evento que llevó el pedido a `estado`, o `null` si el historial no llegó o no lo tiene. */
function ultimoEventoHacia(historial: readonly EventoHistorial[] | undefined, estado: string): EventoHistorial | null {
  return [...(historial ?? [])].reverse().find((evento) => evento.estado_hacia === estado) ?? null;
}

const SUFIJO_PASO = { cumplido: ' (cumplido)', actual: '', pendiente: ' (pendiente)' } as const;

function BandaCancelado({ evento, usuarioId }: { evento: EventoHistorial | null; usuarioId: number }) {
  const cuando = evento === null ? '' : ` el ${fechaLocal(evento.created_at).slice(0, 5)} a las ${horaLocal(evento.created_at)}`;
  const quien = evento === null ? 'El pedido se canceló' : evento.usuario_id === usuarioId ? 'Lo cancelaste' : 'Lo canceló el local';
  const motivo = evento?.motivo ?? null;
  return (
    <div className="cancel-band">
      <Icon name="cerrar" />
      <div>
        <strong>Pedido cancelado</strong>
        <span>{`${quien}${cuando}.`}</span>
        {motivo === null || motivo === '' ? null : <q>{motivo}</q>}
      </div>
    </div>
  );
}

export interface ProgresoPedidoProps {
  pedido: Pick<PedidoDetalle, 'estado_codigo' | 'forma_pago_codigo' | 'direccion' | 'usuario_id'>;
  /** Historial ya cargado; sin él el progreso se ve igual pero sin la fecha de entrega ni el motivo de la cancelación. */
  historial: readonly EventoHistorial[] | undefined;
}

/** Progreso del pedido: cinco pasos con el actual marcado y «qué sigue»; un pedido cancelado muestra una banda con el motivo. */
export function ProgresoPedido({ pedido, historial }: ProgresoPedidoProps) {
  const conEnvio = pedido.direccion !== null;
  if (pedido.estado_codigo === 'CANCELADO') return <BandaCancelado evento={ultimoEventoHacia(historial, 'CANCELADO')} usuarioId={pedido.usuario_id} />;
  const pasos = pasosProgreso(pedido.estado_codigo, conEnvio);
  const actual = pasos?.find((paso) => paso.estado === 'actual');
  const siguiente = queSigue({ estado_codigo: pedido.estado_codigo, forma_pago_codigo: pedido.forma_pago_codigo, conEnvio }, ultimoEventoHacia(historial, 'ENTREGADO')?.created_at ?? null);
  return (
    <>
      {pasos === null ? null : (
        <ol className="prog-steps" aria-label="Progreso del pedido">
          {pasos.map((paso) => (
            <li key={paso.codigo} className={paso.estado === 'cumplido' ? 'is-done' : paso.estado === 'actual' ? 'is-current' : undefined} aria-current={paso.estado === 'actual' ? 'step' : undefined}>
              <span className="sd" aria-hidden="true">
                {paso.estado === 'cumplido' ? <Icon name="guardar" /> : null}
              </span>
              <span className="sl">
                {paso.etiqueta}
                <span className="sr-only">{SUFIJO_PASO[paso.estado]}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {siguiente === null ? null : (
        <p className="prog-next" role="status">
          {actual === undefined ? null : <span className="sr-only">{`Paso actual: ${actual.etiqueta}. `}</span>}
          <Icon name={pedido.estado_codigo === 'ENTREGADO' ? 'exito' : 'reloj'} />
          {siguiente}
        </p>
      )}
    </>
  );
}
