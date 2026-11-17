import { aApiError } from './api-error';
import { crearInstancia } from './instancia';

interface RespuestaToken {
  access_token: string;
}

function esRespuestaToken(cuerpo: unknown): cuerpo is RespuestaToken {
  return typeof cuerpo === 'object' && cuerpo !== null && typeof (cuerpo as Record<string, unknown>).access_token === 'string';
}

// Instancia propia, sin la renovación ante 401: así `renovarAccess` no depende de `apiClient` (que la usa) y no hay bucles.
const clienteRenovacion = crearInstancia();

/** `POST /auth/refresh`: la cookie HttpOnly viaja sola y no hay cuerpo. Devuelve el access nuevo o lanza `ApiError`. */
export async function renovarAccess(): Promise<string> {
  try {
    const { data } = await clienteRenovacion.post<unknown>('/auth/refresh');
    if (!esRespuestaToken(data)) throw new TypeError('La renovación no devolvió un access token');
    return data.access_token;
  } catch (error) {
    throw aApiError(error);
  }
}
