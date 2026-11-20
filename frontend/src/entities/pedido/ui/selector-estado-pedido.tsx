import { esEstadoPedido, ESTADOS_PEDIDO, etiquetaEstado, type EstadoPedidoCodigo } from '../model';

export interface SelectorEstadoPedidoProps {
  /** `id` del `select` (lo da el `Campo` que lo envuelve, que pone la etiqueta visible). */
  id: string;
  /** Estado elegido; `null` = «Todos». */
  valor: EstadoPedidoCodigo | null;
  onCambiar: (estado: EstadoPedidoCodigo | null) => void;
}

/** `select` nativo para filtrar por estado: «Todos» y los seis estados con su etiqueta (gestión y «Mis pedidos»). */
export function SelectorEstadoPedido({ id, valor, onCambiar }: SelectorEstadoPedidoProps) {
  return (
    <select id={id} className="input" value={valor ?? ''} onChange={(evento) => onCambiar(esEstadoPedido(evento.target.value) ? evento.target.value : null)}>
      <option value="">Todos</option>
      {ESTADOS_PEDIDO.map((estado) => (
        <option key={estado} value={estado}>
          {etiquetaEstado(estado)}
        </option>
      ))}
    </select>
  );
}
