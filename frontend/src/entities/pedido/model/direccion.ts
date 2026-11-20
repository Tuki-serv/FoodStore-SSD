import type { DireccionPedido } from './pedido';

export interface LineasDireccion {
  /** Alias («Casa»); vacío si la dirección no tiene. */
  alias: string;
  /** Calle y, si hay, el piso o referencia: «Av. Siempre Viva 742, Timbre 2». */
  calle: string;
  /** Ciudad, provincia y código postal: «Springfield, Buenos Aires · CP 1636». */
  zona: string;
}

/** Líneas de una dirección de entrega para mostrarla en el detalle y en el diálogo de despacho. */
export function lineasDireccion(direccion: DireccionPedido): LineasDireccion {
  const ciudad = [direccion.ciudad, direccion.provincia].filter((parte): parte is string => parte !== null && parte !== '').join(', ');
  const codigoPostal = direccion.codigo_postal === null || direccion.codigo_postal === '' ? '' : ` · CP ${direccion.codigo_postal}`;
  const linea2 = direccion.linea2 === null || direccion.linea2 === '' ? '' : `, ${direccion.linea2}`;
  return { alias: direccion.alias ?? '', calle: `${direccion.linea1}${linea2}`, zona: `${ciudad}${codigoPostal}` };
}
