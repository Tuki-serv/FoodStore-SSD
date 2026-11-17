import { aApiError } from './api-error';
import { crearInstancia } from './instancia';
import { renovarAccess } from './renovar-access';
import { instalarRenovacion } from './renovacion';

/** Única puerta de salida HTTP de la app: las pantallas importan `apiClient` (o las funciones de cada `api/`), nunca `axios`. */
export const apiClient = crearInstancia();

// Orden de los interceptores de response: primero la renovación ante 401, al final la normalización a `ApiError`.
instalarRenovacion(apiClient, renovarAccess);
apiClient.interceptors.response.use(undefined, (error: unknown) => Promise.reject(aApiError(error)));
