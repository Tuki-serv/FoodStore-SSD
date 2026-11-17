import { QueryClient } from '@tanstack/react-query';
import { esApiError, type ApiError } from './api-error';

declare module '@tanstack/react-query' {
  interface Register {
    /** Todo error de consulta o mutación es un `ApiError` (lo garantiza el cliente HTTP). */
    defaultError: ApiError;
  }
}

/** Datos que no dependen del usuario: sobreviven al cierre de sesión. El resto de las claves (primer elemento) es privado. */
export const CLAVES_PUBLICAS: readonly string[] = ['productos', 'categorias', 'ingredientes', 'unidades-medida'];

/** Clave de la consulta de sesión: tampoco se descarta al cerrar sesión (la maneja la propia sesión). */
export const CLAVE_SESION = 'sesion';

/** ¿La consulta guarda datos del usuario? Es privada si el primer elemento de su clave no es público ni la sesión misma. */
export function esConsultaPrivada(queryKey: readonly unknown[]): boolean {
  const [dominio] = queryKey;
  return typeof dominio !== 'string' || (!CLAVES_PUBLICAS.includes(dominio) && dominio !== CLAVE_SESION);
}

export interface OpcionesQueryClient {
  /** `false` apaga todo reintento (tests). */
  conReintentos?: boolean;
  /** Milisegundos entre reintentos; por defecto el retroceso exponencial de TanStack Query. */
  reintentoEspera?: number;
}

const STALE_TIME_MS = 30_000;

/** Un 4xx es una respuesta definitiva del backend: no se reintenta. Red o 5xx: una vez. */
function reintentarConsulta(intentos: number, error: unknown): boolean {
  if (esApiError(error) && error.status !== null && error.status < 500) return false;
  return intentos < 1;
}

export function crearQueryClient({ conReintentos = true, reintentoEspera }: OpcionesQueryClient = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: conReintentos ? reintentarConsulta : false,
        ...(reintentoEspera === undefined ? {} : { retryDelay: reintentoEspera }),
        staleTime: STALE_TIME_MS,
      },
      mutations: { retry: false },
    },
  });
}
