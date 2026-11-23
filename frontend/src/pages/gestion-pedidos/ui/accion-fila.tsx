import { proximoAvance, type AccionPedido, type PedidoResumen } from '@/entities/pedido';
import { claseBoton } from '@/shared/ui';

export interface AccionFilaProps {
  pedido: PedidoResumen;
  onAccion: (accion: AccionPedido) => void;
}

/** Celda «Próxima acción» de una fila: solo el avance (cancelar vive en el detalle); botón neutro (la marca queda para la acción primaria de la página). */
export function AccionFila({ pedido, onAccion }: AccionFilaProps) {
  const avance = proximoAvance(pedido.estado_codigo, pedido.forma_pago_codigo);
  if (avance === null) {
    if (pedido.estado_codigo === 'PENDIENTE') return <span className="none">Espera el pago en Mercado Pago</span>;
    return (
      <span className="none dash" aria-label="Sin acciones">
        —
      </span>
    );
  }
  return (
    <button
      type="button"
      className={claseBoton('neutro', { compacto: true })}
      data-foco={`fila-${pedido.id}`}
      aria-label={`${avance.etiqueta} el pedido #${pedido.id}`}
      onClick={() => onAccion(avance)}
    >
      {avance.etiqueta}
    </button>
  );
}
