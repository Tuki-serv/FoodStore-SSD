import { esEstadoPedido, ESTADOS_PEDIDO, etiquetaEstado, type EstadoPedidoCodigo } from '../model';

export interface SelectorEstadoPedidoProps {
  /** `id` de la etiqueta visible que nombra al grupo; sin él, el grupo se llama «Filtrar por estado». */
  idEtiqueta?: string;
  /** Estado elegido; `null` = «Todos». */
  valor: EstadoPedidoCodigo | null;
  onCambiar: (estado: EstadoPedidoCodigo | null) => void;
}

const OPCIONES: readonly { valor: EstadoPedidoCodigo | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todos' },
  ...ESTADOS_PEDIDO.filter(esEstadoPedido).map((estado) => ({ valor: estado, etiqueta: etiquetaEstado(estado) })),
];

/** Control segmentado para filtrar por estado: «Todos» y los seis estados como botones con `aria-pressed` (design system `.seg`). */
export function SelectorEstadoPedido({ idEtiqueta, valor, onCambiar }: SelectorEstadoPedidoProps) {
  return (
    <div className="seg seg-wrap" role="group" {...(idEtiqueta === undefined ? { 'aria-label': 'Filtrar por estado' } : { 'aria-labelledby': idEtiqueta })}>
      {OPCIONES.map(({ valor: opcion, etiqueta }) => (
        <button key={etiqueta} type="button" aria-pressed={valor === opcion} onClick={() => onCambiar(opcion)}>
          {etiqueta}
        </button>
      ))}
    </div>
  );
}
