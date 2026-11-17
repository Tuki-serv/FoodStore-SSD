import { isAxiosError } from 'axios';

export const DETALLE_GENERICO = 'Ocurrió un error inesperado. Probá de nuevo.';
export const DETALLE_SIN_RESPUESTA = 'No pudimos conectar con el servidor.';

export interface ApiErrorDatos {
  /** `null` = el backend no respondió. */
  status: number | null;
  /** Código del backend, o `NETWORK_ERROR` / `HTTP_<status>` / `UNKNOWN_ERROR`. */
  code: string;
  detail: string;
  field: string | null;
  /** Segundos de espera (solo 429 con `Retry-After` entero positivo). */
  retryAfter?: number;
}

/** Error único que reciben las pantallas: deciden por `code` (y `field`), nunca por el texto de `detail`. */
export class ApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly detail: string;
  readonly field: string | null;
  readonly retryAfter?: number;

  constructor({ status, code, detail, field, retryAfter }: ApiErrorDatos) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.field = field;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

export function esApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

interface CuerpoDeError {
  detail: string;
  code: string;
  field: string | null;
}

function esCuerpoDeError(cuerpo: unknown): cuerpo is CuerpoDeError {
  if (typeof cuerpo !== 'object' || cuerpo === null) return false;
  const { detail, code, field } = cuerpo as Record<string, unknown>;
  return typeof detail === 'string' && typeof code === 'string' && (field === undefined || field === null || typeof field === 'string');
}

function leerRetryAfter(valor: unknown): number | undefined {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor.trim())) return undefined;
  const segundos = Number(valor);
  return segundos > 0 ? segundos : undefined;
}

/** Normaliza cualquier fallo de un pedido (Axios, sin respuesta, desconocido) a `ApiError`. */
export function aApiError(error: unknown): ApiError {
  if (esApiError(error)) return error;
  if (!isAxiosError(error)) {
    return new ApiError({ status: null, code: 'UNKNOWN_ERROR', detail: DETALLE_GENERICO, field: null });
  }
  const { response } = error;
  if (response === undefined) {
    return new ApiError({ status: null, code: 'NETWORK_ERROR', detail: DETALLE_SIN_RESPUESTA, field: null });
  }
  const { status, data } = response;
  const retryAfter = status === 429 ? leerRetryAfter(response.headers['retry-after']) : undefined;
  const base = esCuerpoDeError(data)
    ? { status, code: data.code, detail: data.detail, field: data.field ?? null }
    : { status, code: `HTTP_${status}`, detail: DETALLE_GENERICO, field: null };
  return new ApiError(retryAfter === undefined ? base : { ...base, retryAfter });
}

/** `detail` del error si corresponde al campo de formulario dado; `undefined` en cualquier otro caso. */
export function mensajeDeCampo(error: unknown, campo: string): string | undefined {
  return esApiError(error) && error.field === campo ? error.detail : undefined;
}
