import { isAxiosError, type AxiosInstance, type AxiosRequestHeaders, type RawAxiosRequestHeaders } from 'axios';
import { useAuthStore } from '@/shared/auth';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** Marca interna: el pedido ya se repitió una vez tras una renovación. */
    _reintentado?: boolean;
  }
}

/** Un 401 de estos pedidos no es «access vencido»: son credenciales inválidas (login) o evitar un bucle (refresh). */
const URLS_SIN_RENOVACION: readonly string[] = ['/auth/login', '/auth/refresh'];

export function esUrlSinRenovacion(url: string | undefined): boolean {
  if (url === undefined) return false;
  const path = url.split('?')[0] ?? url;
  return URLS_SIN_RENOVACION.some((excluida) => path === excluida || path.endsWith(excluida));
}

/** Access con el que salió un pedido (valor del header `Authorization: Bearer <access>`), o `null` si salió sin él. */
export function bearerEnviado(headers: AxiosRequestHeaders | RawAxiosRequestHeaders | undefined): string | null {
  const valor = headers?.Authorization ?? headers?.authorization;
  const texto = typeof valor === 'string' ? valor : valor?.toString();
  return texto?.startsWith('Bearer ') === true ? texto.slice('Bearer '.length) : null;
}

let renovacionEnCurso: Promise<string> | null = null;

/** Una sola renovación a la vez: los 401 concurrentes esperan la misma (evita el reuso del refresh rotado, RN-AU-05). */
function renovarUnaVez(renovar: () => Promise<string>): Promise<string> {
  if (renovacionEnCurso !== null) return renovacionEnCurso;
  // Access con el que arranca la renovación: si cambia antes de que termine (logout, login nuevo), el resultado se descarta.
  const previo = useAuthStore.getState().accessToken;
  const promesa = renovar()
    .then((access) => {
      useAuthStore.getState().renovarAccess(previo, access);
      return access;
    })
    .catch((error: unknown) => {
      useAuthStore.getState().expirarSesion(previo);
      throw error;
    })
    .finally(() => {
      renovacionEnCurso = null;
    });
  renovacionEnCurso = promesa;
  return promesa;
}

/** Solo para tests: descarta una renovación que haya quedado en curso. */
export function reiniciarRenovacion(): void {
  renovacionEnCurso = null;
}

/** Ante un 401 renueva el access (una sola vez a la vez) y repite el pedido original una única vez. */
export function instalarRenovacion(cliente: AxiosInstance, renovar: () => Promise<string>): void {
  cliente.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || error.config === undefined) throw error;
    const config = error.config;
    if (esUrlSinRenovacion(config.url) || config._reintentado === true) throw error;
    config._reintentado = true;

    const actual = useAuthStore.getState().accessToken;
    // 401 tardío: otra renovación ya terminó; basta repetir con el access actual.
    if (actual !== null && actual !== bearerEnviado(config.headers)) return cliente.request(config);

    try {
      await renovarUnaVez(renovar);
    } catch {
      throw error;
    }
    return cliente.request(config);
  });
}
