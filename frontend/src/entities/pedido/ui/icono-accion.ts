import type { IconName } from '@/shared/ui';
import type { AccionPedido } from '../model';

const ICONOS: Record<AccionPedido['destino'], IconName> = {
  PENDIENTE: 'reloj',
  CONFIRMADO: 'exito',
  EN_PREP: 'plato',
  EN_CAMINO: 'moto',
  ENTREGADO: 'exito',
  CANCELADO: 'cerrar',
};

/** Ícono de una acción de gestión según el estado al que lleva. */
export function iconoAccion(accion: AccionPedido): IconName {
  return ICONOS[accion.destino];
}
