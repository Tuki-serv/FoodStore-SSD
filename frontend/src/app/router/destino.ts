import { ACCESO_RUTAS, puedeAcceder, RUTAS, type Ruta } from '@/shared/config';

/** Ruta pedida por un visitante anónimo, recordada en el `state` de la navegación a `/ingresar`. */
export interface RutaRecordada {
  pathname: string;
  search: string;
  hash: string;
}

export function rutaRecordada(location: { pathname: string; search: string; hash: string }): RutaRecordada {
  return { pathname: location.pathname, search: location.search, hash: location.hash };
}

function esRutaConocida(pathname: string): pathname is Ruta {
  return Object.prototype.hasOwnProperty.call(ACCESO_RUTAS, pathname);
}

function esRutaRecordada(valor: unknown): valor is RutaRecordada {
  if (typeof valor !== 'object' || valor === null) return false;
  const { pathname, search, hash } = valor as Record<string, unknown>;
  return typeof pathname === 'string' && typeof search === 'string' && typeof hash === 'string';
}

/**
 * A dónde ir cuando un usuario con sesión abre `/ingresar` o `/registrarse`: a la ruta que había pedido si es una ruta
 * propia de la app (nunca `//host` ni una URL externa: evita el redirect abierto) y accesible con sus roles; si no, al catálogo.
 */
export function destinoTrasIngresar(state: unknown, roles: readonly string[]): string {
  const recordada = typeof state === 'object' && state !== null ? (state as { desde?: unknown }).desde : undefined;
  if (!esRutaRecordada(recordada)) return RUTAS.catalogo;
  const { pathname, search, hash } = recordada;
  if (!pathname.startsWith('/') || pathname.startsWith('//') || !esRutaConocida(pathname)) return RUTAS.catalogo;
  if (!puedeAcceder(ACCESO_RUTAS[pathname], 'autenticada', roles)) return RUTAS.catalogo;
  return `${pathname}${search}${hash}`;
}
