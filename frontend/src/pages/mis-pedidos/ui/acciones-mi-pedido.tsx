import { puedeCancelarCliente, type PedidoDetalle } from '@/entities/pedido';
import { claseBoton, Icon } from '@/shared/ui';

export interface AccionesMiPedidoProps {
  pedido: Pick<PedidoDetalle, 'estado_codigo'>;
  /** Abre el diálogo de cancelación (lo monta la página: tiene que seguir abierto aunque el pedido avance). */
  onCancelar: () => void;
}

/** «¿Cambiaste de idea?»: cancelar mientras el local no empezó a prepararlo, o por qué ya no se puede (nada en un pedido terminado). */
export function AccionesMiPedido({ pedido, onCancelar }: AccionesMiPedidoProps) {
  const estado = pedido.estado_codigo;
  if (estado === 'ENTREGADO' || estado === 'CANCELADO') return null;
  return (
    <section className="ocard c-acc" aria-labelledby="acciones-titulo">
      <h2 id="acciones-titulo">¿Cambiaste de idea?</h2>
      {puedeCancelarCliente(estado) ? (
        <>
          <p className="acts-none">Podés cancelarlo mientras el local no empiece a prepararlo.</p>
          <div className="acts">
            <button type="button" className={claseBoton('peligroContorno')} data-foco="cancelar" onClick={onCancelar}>
              <Icon name="cerrar" />
              Cancelar pedido
            </button>
          </div>
        </>
      ) : (
        <p className="acts-none">
          <Icon name="candado" />
          {`${estado === 'EN_PREP' ? 'Tu pedido ya se está preparando: no se puede cancelar.' : 'Tu pedido ya salió del local: no se puede cancelar.'} Si hay un problema, comunicate con el local.`}
        </p>
      )}
    </section>
  );
}
