export interface AppConfig {
  /** URL base del backend, sin barra final obligatoria. */
  apiUrl: string;
}

/** Variables `VITE_*` que lee el frontend: deben coincidir con las claves de `frontend/.env.example`. */
export const VARIABLES_FRONTEND = ['VITE_API_URL'] as const;

type Entorno = Readonly<Record<string, string | undefined>>;

function esUrlHttp(valor: string): boolean {
  try {
    const { protocol } = new URL(valor);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Lee y valida la configuración. Falla rápido, nombrando la variable, si falta o es inválida (DD-18: sin defaults ocultos). */
export function readConfig(env: Entorno): AppConfig {
  const apiUrl = env.VITE_API_URL;
  if (apiUrl === undefined || apiUrl.trim() === '') {
    throw new Error('Falta la variable VITE_API_URL (URL base del backend). Copiá frontend/.env.example a frontend/.env.');
  }
  if (!esUrlHttp(apiUrl)) {
    throw new Error(`La variable VITE_API_URL debe ser una URL http(s) válida; recibió "${apiUrl}".`);
  }
  return { apiUrl };
}
