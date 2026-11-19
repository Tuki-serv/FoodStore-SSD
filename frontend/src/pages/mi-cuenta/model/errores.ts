import type { ApiError } from '@/shared/api';
import type { CampoPerfil } from './validacion';

const CAMPOS_DEL_SERVIDOR: readonly CampoPerfil[] = ['nombre', 'apellido', 'celular'];

function esCampoDelServidor(campo: string | null): campo is CampoPerfil {
  return CAMPOS_DEL_SERVIDOR.some((nombre) => nombre === campo);
}

/** Qué muestra «Mi cuenta» tras un fallo del `PATCH /usuarios/me` (design D3). */
export interface ErroresServidorPerfil {
  campos: Partial<Record<CampoPerfil, string>>;
  /** Alerta general cuando el error no corresponde a ningún campo. */
  alerta?: string;
}

/** Traduce el `ApiError` del guardado; decide por `code`/`field`, nunca por el texto de `detail`. */
export function erroresDePerfil(error: ApiError): ErroresServidorPerfil {
  if (error.code === 'VALIDATION_ERROR' && esCampoDelServidor(error.field)) return { campos: { [error.field]: error.detail } };
  return { campos: {}, alerta: error.detail };
}
