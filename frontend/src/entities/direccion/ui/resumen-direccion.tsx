import type { Direccion } from '../model';

/** Línea 1 y, si existe, línea 2. */
function lineaDireccion(direccion: Direccion): string {
  const linea2 = direccion.linea2?.trim();
  return linea2 === undefined || linea2 === '' ? direccion.linea1 : `${direccion.linea1}, ${linea2}`;
}

/** «Ciudad, Provincia · CP 5500» con solo las partes presentes y sin separadores sueltos. */
function subLineaDireccion(direccion: Direccion): string {
  const lugar = [direccion.ciudad, direccion.provincia].filter((parte): parte is string => parte !== null && parte.trim() !== '').join(', ');
  const cp = direccion.codigo_postal?.trim();
  return cp === undefined || cp === '' ? lugar : `${lugar} · CP ${cp}`;
}

export interface ResumenDireccionProps {
  direccion: Direccion;
  /** Muestra la marca «Principal» (por defecto sí). */
  conMarca?: boolean;
}

/** Texto de una dirección: alias (o «Sin alias») con la marca «Principal», línea 1 y 2, y ciudad/provincia/CP. */
export function ResumenDireccion({ direccion, conMarca = true }: ResumenDireccionProps) {
  const alias = direccion.alias?.trim();
  return (
    <span className="addr-body">
      <span className="addr-title">
        {alias === undefined || alias === '' ? <strong className="muted">Sin alias</strong> : <strong>{alias}</strong>}
        {conMarca && direccion.es_principal ? <span className="badge b-principal">Principal</span> : null}
      </span>
      <span className="addr-line">{lineaDireccion(direccion)}</span>
      <span className="addr-sub">{subLineaDireccion(direccion)}</span>
    </span>
  );
}
