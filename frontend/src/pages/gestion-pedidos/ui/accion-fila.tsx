import { iconoAccion, proximoAvance, type AccionPedido, type PedidoResumen } from '@/entities/pedido';
import { claseBoton, Icon } from '@/shared/ui';

export interface AccionFilaProps {
  pedido: PedidoResumen;
  onAccion: (accion: AccionPedido) => void;
}

/** Celda «Próxima acción» de una fila: solo el avance (cancelar vive en el detalle); «Confirmar pago» es el único relleno. */
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
      className={avance.tipo === 'confirmar-pago' ? claseBoton('primario', { compacto: true }) : claseBoton('secundario', { compacto: true })}
      data-foco={`fila-${pedido.id}`}
      aria-label={`${avance.etiqueta} el pedido #${pedido.id}`}
      onClick={() => onAccion(avance)}
    >
      <Icon name={iconoAccion(avance)} />
      {avance.etiqueta}
    </button>
  );
}
