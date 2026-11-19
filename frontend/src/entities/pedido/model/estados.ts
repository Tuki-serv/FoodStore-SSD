/** Estados del pedido (FSM de RN-ST; seed de `estado_pedido`) con el texto que ve la persona. */
const ETIQUETAS_ESTADO: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP: 'En preparación',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Texto de un estado; un código que no se conoce se muestra tal cual. */
export function etiquetaEstado(codigo: string): string {
  return ETIQUETAS_ESTADO[codigo] ?? codigo;
}

/** Clase de color del distintivo (`b-pendiente`, `b-en-prep`…); neutra para un estado desconocido. */
export function claseEstado(codigo: string): string {
  return codigo in ETIQUETAS_ESTADO ? `b-${codigo.toLowerCase().replace(/_/g, '-')}` : 'b-neutro';
}
