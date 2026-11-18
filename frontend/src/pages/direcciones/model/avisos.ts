import { esApiError, type ApiError } from '@/shared/api';
import { useUiStore } from '@/shared/model';

/** 403/404 de una acción sobre una dirección: ya no existe o no es del usuario (la eliminaron en otra pestaña). */
export function esDireccionNoDisponible(error: ApiError): boolean {
  return error.code === 'HTTP_403' || error.code === 'HTTP_404';
}

export function avisarExito(titulo: string): void {
  useUiStore.getState().notificar({ tipo: 'success', titulo });
}

/** Notificación de error de una acción (editar, marcar principal, eliminar): una sola redacción para toda la página. */
export function avisarErrorAccion(error: ApiError): void {
  const { notificar } = useUiStore.getState();
  if (esDireccionNoDisponible(error)) {
    notificar({ tipo: 'error', titulo: 'Esa dirección ya no está disponible' });
    return;
  }
  notificar({ tipo: 'error', titulo: 'No pudimos completar la acción', mensaje: error.detail });
}

/**
 * Corre una acción (mutación) y avisa su resultado: éxito con `tituloExito`, error con `avisarErrorAccion`.
 * Se avisa por cada llamada (no por el último `mutate` del hook), así dos acciones superpuestas no pierden su aviso.
 * Devuelve `true` si salió bien.
 */
export async function avisarResultado(accion: Promise<unknown>, tituloExito: string): Promise<boolean> {
  try {
    await accion;
  } catch (error) {
    if (!esApiError(error)) throw error;
    avisarErrorAccion(error);
    return false;
  }
  avisarExito(tituloExito);
  return true;
}
