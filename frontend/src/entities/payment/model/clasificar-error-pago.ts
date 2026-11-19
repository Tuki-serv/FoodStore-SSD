import type { ApiError } from '@/shared/api';

/** Qué le toca hacer a la persona ante un fallo de `POST /pagos/crear` (design D6). */
export type ClaseErrorPago = 'no-permitido' | 'rechazado-datos' | 'desconocido' | 'no-disponible' | 'no-encontrado' | 'conexion';

export function clasificarErrorPago(error: ApiError): ClaseErrorPago {
  switch (error.status) {
    case 409:
      return 'no-permitido';
    case 400:
      return 'rechazado-datos';
    case 502:
      return 'desconocido';
    case 503:
      return 'no-disponible';
    case 403:
    case 404:
      return 'no-encontrado';
    default:
      return 'conexion';
  }
}
