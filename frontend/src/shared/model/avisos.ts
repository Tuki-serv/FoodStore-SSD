import { useUiStore } from './ui-store';

/** Notificación de éxito (toast) con título y, opcionalmente, un texto que lo amplía. */
export function avisarExito(titulo: string, mensaje?: string): void {
  useUiStore.getState().notificar({ tipo: 'success', titulo, ...(mensaje === undefined ? {} : { mensaje }) });
}

/** Notificación de error (toast) con título y, opcionalmente, el detalle. */
export function avisarError(titulo: string, mensaje?: string): void {
  useUiStore.getState().notificar({ tipo: 'error', titulo, ...(mensaje === undefined ? {} : { mensaje }) });
}
