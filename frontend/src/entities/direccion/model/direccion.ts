/** Dirección de entrega tal como la expone el backend (`DireccionRead`). */
export interface Direccion {
  id: number;
  usuario_id: number;
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigo_postal: string | null;
  es_principal: boolean;
}

/**
 * Cuerpo de alta y edición (`DireccionCreate`/`DireccionUpdate`). `linea1` y `ciudad` son NOT NULL en el backend:
 * por eso son `string` y nunca `null` (un `null` en un `PATCH` terminaría en 500).
 */
export interface DireccionDatos {
  alias: string | null;
  linea1: string;
  linea2: string | null;
  ciudad: string;
  provincia: string | null;
  codigo_postal: string | null;
}

/** Id de la dirección a preseleccionar: la principal; si no hay, la primera; sin direcciones, `null`. */
export function direccionPorDefecto(direcciones: readonly Direccion[]): number | null {
  const elegida = direcciones.find((direccion) => direccion.es_principal) ?? direcciones[0];
  return elegida === undefined ? null : elegida.id;
}

/** Cómo se nombra una dirección en pantalla y en nombres accesibles: su alias o, si no tiene, la línea 1. */
export function nombreDireccion(direccion: Pick<Direccion, 'alias' | 'linea1'>): string {
  const alias = direccion.alias?.trim();
  return alias === undefined || alias === '' ? direccion.linea1 : alias;
}
