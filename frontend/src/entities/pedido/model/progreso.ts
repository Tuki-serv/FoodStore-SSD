import { etiquetaEstado } from './estados';
import type { EstadoPedidoCodigo } from './pedido';

export type SituacionPaso = 'cumplido' | 'actual' | 'pendiente';

export interface PasoProgreso {
  codigo: EstadoPedidoCodigo;
  /** Texto del paso; en un retiro en el local el paso 4 es «Listo para retirar». */
  etiqueta: string;
  estado: SituacionPaso;
}

/** El camino feliz del pedido, en orden (la FSM sin `CANCELADO`). */
const CAMINO: readonly EstadoPedidoCodigo[] = ['PENDIENTE', 'CONFIRMADO', 'EN_PREP', 'EN_CAMINO', 'ENTREGADO'];

/**
 * Los cinco pasos del seguimiento con su situación según el estado (design D6): los anteriores al actual están cumplidos;
 * `ENTREGADO` los cumple todos. Un pedido `CANCELADO` (o de un estado que no se conoce) no tiene camino: `null`.
 * Sin envío (`conEnvio` falso, retiro en el local) el paso 4 se llama «Listo para retirar».
 */
export function pasosProgreso(estado: string, conEnvio: boolean): PasoProgreso[] | null {
  const indice = CAMINO.findIndex((codigo) => codigo === estado);
  if (indice === -1) return null;
  const terminado = estado === 'ENTREGADO';
  const situacion = (posicion: number): SituacionPaso => (posicion < indice || (terminado && posicion === indice) ? 'cumplido' : posicion === indice ? 'actual' : 'pendiente');
  return CAMINO.map((codigo, posicion) => ({
    codigo,
    etiqueta: codigo === 'EN_CAMINO' && !conEnvio ? 'Listo para retirar' : etiquetaEstado(codigo),
    estado: situacion(posicion),
  }));
}
