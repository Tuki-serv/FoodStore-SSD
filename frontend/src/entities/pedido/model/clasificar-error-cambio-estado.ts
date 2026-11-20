import type { ApiError } from '@/shared/api';

/** Qué le toca hacer a la persona ante un rechazo de `PATCH /pedidos/{id}/estado`. */
export type ClaseErrorCambioEstado = 'sin-stock' | 'transicion' | 'motivo' | 'sin-permiso' | 'no-existe' | 'conexion' | 'otro';

/** Decide por el `code` (y `field`) del backend, nunca por el texto del `detail` (design D8). */
export function clasificarErrorCambioEstado(error: ApiError): ClaseErrorCambioEstado {
  if (error.status === null || error.status >= 500) return 'conexion';
  if (error.status === 409 && error.code === 'INSUFFICIENT_STOCK') return 'sin-stock';
  if (error.status === 409 && error.code === 'INVALID_TRANSITION') return 'transicion';
  if (error.status === 422 && error.field === 'motivo') return 'motivo';
  if (error.status === 403) return 'sin-permiso';
  if (error.status === 404) return 'no-existe';
  return 'otro';
}
