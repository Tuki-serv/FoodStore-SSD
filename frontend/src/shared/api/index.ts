export { aApiError, ApiError, DETALLE_GENERICO, DETALLE_SIN_RESPUESTA, esApiError, mensajeDeCampo } from './api-error';
export type { ApiErrorDatos } from './api-error';
export {
  aUsuarioSesion,
  cerrarSesionRemota,
  cerrarTodasLasSesionesRemota,
  obtenerUsuarioActual,
  renovarAccess,
} from './auth';
export { apiClient } from './http-client';
export type { Paginado } from './paginacion';
export { CLAVE_SESION, CLAVES_PUBLICAS, crearQueryClient, esConsultaPrivada } from './query-client';
export type { OpcionesQueryClient } from './query-client';
