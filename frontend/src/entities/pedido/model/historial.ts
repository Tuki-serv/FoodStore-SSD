import { etiquetaEstado } from './estados';
import type { EventoHistorial } from './pedido';

/** Título del evento: la fila sin estado de origen es la creación del pedido. */
export function tituloEvento(evento: EventoHistorial): string {
  return evento.estado_desde === null ? 'Pedido creado' : etiquetaEstado(evento.estado_hacia);
}

/** Quién hizo el cambio: su nombre, «Sistema» si no hubo usuario (pago aprobado) o `Usuario #N` si falta el nombre. */
export function autorEvento(evento: EventoHistorial): string {
  if (evento.usuario_nombre !== null) return evento.usuario_nombre;
  return evento.usuario_id === null ? 'Sistema' : `Usuario #${evento.usuario_id}`;
}
