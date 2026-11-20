import type { EstadoPedidoCodigo } from './pedido';

/** Estados del pedido (FSM de RN-ST; seed de `estado_pedido`) con el texto que ve la persona. */
const ETIQUETAS_ESTADO: Readonly<Record<string, string>> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREP: 'En preparación',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

/** Los seis estados del pedido, en el orden de la FSM (el de los filtros por estado). */
export const ESTADOS_PEDIDO: readonly EstadoPedidoCodigo[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'];

/** `true` si el valor es el código de uno de los seis estados (sin distinguir nada más: `null`, `''` o minúsculas no lo son). */
export function esEstadoPedido(valor: string | null): valor is EstadoPedidoCodigo {
  return ESTADOS_PEDIDO.some((estado) => estado === valor);
}

/** `true` si el pedido ya no cambia (`ENTREGADO` o `CANCELADO`): no hace falta seguir pidiéndolo. Sin estado o desconocido = en curso. */
export function esEstadoTerminal(codigo: string | undefined): boolean {
  return codigo === 'ENTREGADO' || codigo === 'CANCELADO';
}

/** Texto de un estado; un código que no se conoce se muestra tal cual. */
export function etiquetaEstado(codigo: string): string {
  return ETIQUETAS_ESTADO[codigo] ?? codigo;
}

/**
 * Clases de color del distintivo, escritas completas: Tailwind solo conserva las reglas de `pedido.css` cuyas clases
 * aparecen literales en el código (armarlas con una plantilla purgaba `b-confirmado` y `b-entregado`).
 */
const CLASES_ESTADO: Readonly<Record<string, string>> = {
  PENDIENTE: 'b-pendiente',
  CONFIRMADO: 'b-confirmado',
  EN_PREP: 'b-en-prep',
  EN_CAMINO: 'b-en-camino',
  ENTREGADO: 'b-entregado',
  CANCELADO: 'b-cancelado',
};

/** Clase de color del distintivo (`b-pendiente`, `b-en-prep`…); neutra para un estado desconocido. */
export function claseEstado(codigo: string): string {
  return CLASES_ESTADO[codigo] ?? 'b-neutro';
}

/** Color de texto del distintivo de cada estado (token del design system), para los gráficos: el mismo de `.b-<estado>`. */
export const COLOR_ESTADO: Readonly<Record<string, string>> = {
  PENDIENTE: 'var(--state-pendiente-fg)',
  CONFIRMADO: 'var(--state-confirmado-fg)',
  EN_PREP: 'var(--state-en-prep-fg)',
  EN_CAMINO: 'var(--state-en-camino-fg)',
  ENTREGADO: 'var(--state-entregado-fg)',
  CANCELADO: 'var(--state-cancelado-fg)',
};

/** Color del estado para un gráfico; el gris neutro del distintivo para un estado desconocido. */
export function colorEstado(codigo: string): string {
  return COLOR_ESTADO[codigo] ?? 'var(--color-text-muted)';
}
