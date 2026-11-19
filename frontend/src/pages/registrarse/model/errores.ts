import type { ApiError } from '@/shared/api';
import type { CampoRegistro } from './validacion';

/** Campos del formulario que el backend puede nombrar en `field` (la repetición de la contraseña no se envía). */
const CAMPOS_DEL_SERVIDOR: readonly CampoRegistro[] = ['nombre', 'apellido', 'email', 'celular', 'password'];

function esCampoDelServidor(campo: string | null): campo is CampoRegistro {
  return CAMPOS_DEL_SERVIDOR.some((nombre) => nombre === campo);
}

/** Qué muestra el registro tras un fallo del `POST /auth/register` (design D3). */
export interface ErroresServidorRegistro {
  campos: Partial<Record<CampoRegistro, string>>;
  /** Alerta general cuando el error no corresponde a ningún campo. */
  alerta?: string;
  /** El 409 ofrece el enlace a «Ingresar» junto al email. */
  emailDuplicado: boolean;
}

/** Traduce el `ApiError` del registro; decide por `status`/`code`/`field`, nunca por el texto de `detail`. */
export function erroresDeRegistro(error: ApiError): ErroresServidorRegistro {
  // El 409 llega con `field: null`: se decide por status.
  if (error.status === 409) return { campos: { email: 'Ya existe una cuenta con este email.' }, emailDuplicado: true };
  if (error.code === 'VALIDATION_ERROR' && esCampoDelServidor(error.field)) {
    return { campos: { [error.field]: error.detail }, emailDuplicado: false };
  }
  return { campos: {}, alerta: error.detail, emailDuplicado: false };
}
