// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

const REGLAS = reglasDeSrc();

function declaraciones(selector: string): Record<string, string> {
  const fusion: Record<string, string> = {};
  for (const regla of REGLAS) if (regla.selector.replace(/\s+/g, ' ') === selector) Object.assign(fusion, regla.declaraciones);
  return fusion;
}

/** Encabezado de columnas de cada listado de administración y el contenedor que lo recorta. */
const LISTADOS = [
  { cabecera: '.orow.ohead', contenedor: '.olist' },
  { cabecera: '.plist > .phead', contenedor: '.plist' },
  { cabecera: '.ilist > .ihead', contenedor: '.ilist' },
  { cabecera: '.ilist > .uhead', contenedor: '.ilist' },
];

describe('encabezados de tabla fijos bajo el encabezado de página (spec «Encabezados de tabla fijos»)', () => {
  it.each(LISTADOS)('$cabecera queda fija con top = --band-h y su contenedor recorta sin crear scroll propio', ({ cabecera, contenedor }) => {
    const fila = declaraciones(cabecera);

    expect(fila['position']).toBe('sticky');
    expect(fila['top']).toBe('var(--band-h,0px)');
    expect(declaraciones(contenedor)['overflow']).toBe('clip');
  });
});
