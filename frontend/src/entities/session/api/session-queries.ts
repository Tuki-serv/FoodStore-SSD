import { queryOptions } from '@tanstack/react-query';
import { CLAVE_SESION, obtenerUsuarioActual } from '@/shared/api';
import { rehidratarSesion } from './rehidratar';

/** Consultas de la sesión (claves jerárquicas con el dominio primero). */
export const sesionQueries = {
  todas: () => [CLAVE_SESION] as const,
  /** Rehidratación al arrancar: una sola vez por carga (`staleTime` infinito, sin reintentos). */
  rehidratar: () =>
    queryOptions({
      queryKey: [CLAVE_SESION, 'rehidratar'] as const,
      queryFn: async () => {
        await rehidratarSesion();
        return true;
      },
      staleTime: Infinity,
      retry: false,
    }),
  /**
   * Verificación de que la sesión sigue abierta (`GET /auth/me`): siempre vuelve a pedir (`staleTime` 0) y no reintenta.
   * Un 401 ya pasó por la renovación del cliente HTTP; el que decide qué hacer con el resultado es `useRevalidarSesion`.
   */
  vigencia: () =>
    queryOptions({
      queryKey: [CLAVE_SESION, 'vigencia'] as const,
      queryFn: () => obtenerUsuarioActual(),
      staleTime: 0,
      retry: false,
    }),
};
