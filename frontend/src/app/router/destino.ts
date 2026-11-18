import { ACCESO_RUTAS, puedeAcceder, RUTAS, type Ruta } from '@/shared/config';
import { rutaRecordada, type RutaRecordada } from '@/shared/lib';

export { rutaRecordada };
export type { RutaRecordada };

/** Detalle de producto (`/catalogo/<id>`, id entero positivo sin ceros a la izquierda): sub-ruta pública del catálogo. */
const REGEX_DETALLE_PRODUCTO = /^\/catalogo\/[1-9]\d*$/;

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
 * propia de la app (incluido el detalle de un producto; nunca `//host` ni una URL externa: evita el redirect abierto) y accesible con sus roles; si no, al catálogo.
 */
export function destinoTrasIngresar(state: unknown, roles: readonly string[]): string {
  const recordada = typeof state === 'object' && state !== null ? (state as { desde?: unknown }).desde : undefined;
  if (!esRutaRecordada(recordada)) return RUTAS.catalogo;
  const { pathname, search, hash } = recordada;
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return RUTAS.catalogo;
  if (REGEX_DETALLE_PRODUCTO.test(pathname)) return `${pathname}${search}${hash}`;
  if (!esRutaConocida(pathname)) return RUTAS.catalogo;
  if (!puedeAcceder(ACCESO_RUTAS[pathname], 'autenticada', roles)) return RUTAS.catalogo;
  return `${pathname}${search}${hash}`;
}
