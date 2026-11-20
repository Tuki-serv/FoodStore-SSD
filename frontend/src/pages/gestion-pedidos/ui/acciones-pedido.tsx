import { accionesGestion, iconoAccion, type AccionPedido, type PedidoDetalle } from '@/entities/pedido';
import { claseBoton, Icon } from '@/shared/ui';

export interface AccionesPedidoProps {
  pedido: Pick<PedidoDetalle, 'estado_codigo' | 'forma_pago_codigo'>;
  onAccion: (accion: AccionPedido, origen: HTMLButtonElement) => void;
}

/** Tarjeta «Acciones»: solo lo que la FSM permite a `PEDIDOS`/`ADMIN` según el estado y la forma de pago. */
export function AccionesPedido({ pedido, onAccion }: AccionesPedidoProps) {
  const acciones = accionesGestion(pedido.estado_codigo, pedido.forma_pago_codigo);
  const esperaMercadoPago = pedido.estado_codigo === 'PENDIENTE' && pedido.forma_pago_codigo === 'MERCADOPAGO';
  return (
    <section className="ocard acciones" aria-labelledby="acciones-titulo">
      <h2 id="acciones-titulo">Acciones</h2>
      {acciones.length === 0 ? (
        <p className="acts-none">{pedido.estado_codigo === 'CANCELADO' ? 'El pedido está cancelado: no admite más cambios.' : 'El pedido ya se entregó: no admite más cambios.'}</p>
      ) : (
        <div className="acts">
          {esperaMercadoPago ? (
            <div className="info-box" role="note">
              <Icon name="tarjeta" />
              <div>
                <strong>Se confirma solo cuando Mercado Pago aprueba el pago</strong>
                No hace falta confirmarlo a mano. Si el cliente no paga, podés cancelarlo.
              </div>
            </div>
          ) : null}
          {acciones.map((accion) => (
            <button
              key={accion.destino}
              type="button"
              className={claseBoton(accion.tipo === 'cancelar' ? 'peligroContorno' : 'primario')}
              data-foco={accion.tipo}
              onClick={(evento) => onAccion(accion, evento.currentTarget)}
            >
              <Icon name={iconoAccion(accion)} />
              {accion.etiqueta}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
