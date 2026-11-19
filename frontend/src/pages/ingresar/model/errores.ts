import type { ApiError } from '@/shared/api';

/** Qué muestra la pantalla de ingreso tras un fallo del login (design D3/D4). */
export interface AvisoIngreso {
  /** `alerta` = error (rojo); `bloqueo` = aviso de demasiados intentos. */
  tipo: 'alerta' | 'bloqueo';
  titulo: string;
  detalle?: string;
  /** El 401 vacía la contraseña; el resto la conserva. */
  limpiarPassword: boolean;
  /** Instante (ms) hasta el que «Ingresar» queda deshabilitado; `null` = sin bloqueo. */
  bloqueoHasta: number | null;
}

function minutos(segundos: number): string {
  const n = Math.ceil(segundos / 60);
  return n === 1 ? '1 minuto' : `${n} minutos`;
}

/** Traduce el `ApiError` del login a lo que muestra la pantalla; decide por `status`/`code`, nunca por el texto de `detail`. */
export function avisoDeErrorIngreso(error: ApiError, ahora: number): AvisoIngreso {
  if (error.status === 401) {
    return {
      tipo: 'alerta',
      titulo: 'Email o contraseña incorrectos.',
      detalle: 'Revisá los datos e intentá de nuevo.',
      limpiarPassword: true,
      bloqueoHasta: null,
    };
  }
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    const base = 'Por seguridad bloqueamos el ingreso desde esta conexión.';
    const { retryAfter } = error;
    return {
      tipo: 'bloqueo',
      titulo: 'Demasiados intentos.',
      detalle: retryAfter === undefined ? `${base} Probá de nuevo en unos minutos.` : `${base} Probá de nuevo en ${minutos(retryAfter)}.`,
      limpiarPassword: false,
      bloqueoHasta: retryAfter === undefined ? null : ahora + retryAfter * 1000,
    };
  }
  return {
    tipo: 'alerta',
    titulo: error.detail,
    ...(error.code === 'NETWORK_ERROR' ? { detalle: 'Revisá tu conexión e intentá de nuevo.' } : {}),
    limpiarPassword: false,
    bloqueoHasta: null,
  };
}
