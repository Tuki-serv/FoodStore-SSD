import { claseEstado, etiquetaEstado } from '../model';

/** Distintivo con el estado del pedido (texto + color del design system). */
export function BadgeEstado({ codigo }: { codigo: string }) {
  return <span className={`badge ${claseEstado(codigo)}`}>{etiquetaEstado(codigo)}</span>;
}
