import { accionesGestion, iconoAccion, type AccionPedido, type PedidoDetalle } from '@/entities/pedido';
import { claseBoton, Icon } from '@/shared/ui';

export interface AccionesPedidoProps {
  pedido: Pick<PedidoDetalle, 'estado_codigo' | 'forma_pago_codigo'>;
  onAccion: (accion: AccionPedido, origen: HTMLButtonElement) => void;
}

/** Aviso de un pedido de Mercado Pago pendiente: no se confirma a mano. */
export function AvisoMercadoPago({ pedido }: { pedido: Pick<PedidoDetalle, 'estado_codigo' | 'forma_pago_codigo'> }) {
  if (!(pedido.estado_codigo === 'PENDIENTE' && pedido.forma_pago_codigo === 'MERCADOPAGO')) return null;
  return (
    <div className="info-box" role="note">
      <Icon name="tarjeta" />
      <div>
        <strong>Se confirma solo cuando Mercado Pago aprueba el pago</strong>
        No hace falta confirmarlo a mano. Si el cliente no paga, podés cancelarlo.
      </div>
    </div>
  );
}

/** «Acciones» del encabezado fijo: solo lo que la FSM permite a `PEDIDOS`/`ADMIN` según el estado y la forma de pago. */
export function AccionesPedido({ pedido, onAccion }: AccionesPedidoProps) {
  const acciones = accionesGestion(pedido.estado_codigo, pedido.forma_pago_codigo);
  return (
    <section className="band-acts" aria-label="Acciones">
      {acciones.length === 0 ? (
        <p className="acts-none">{pedido.estado_codigo === 'CANCELADO' ? 'El pedido está cancelado: no admite más cambios.' : 'El pedido ya se entregó: no admite más cambios.'}</p>
      ) : (
        acciones.map((accion) => (
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
        ))
      )}
    </section>
  );
}
