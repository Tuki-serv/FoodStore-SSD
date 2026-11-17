import { queryOptions } from '@tanstack/react-query';
import { CLAVE_SESION } from '@/shared/api';
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
};
