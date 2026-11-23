// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reglasDeSrc } from './css-src';

const SRC = resolve(process.cwd(), 'src');

function fuentes(directorio: string): string[] {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : fuentes(ruta);
    return /\.tsx?$/.test(nombre) && !/\.test\./.test(nombre) ? [ruta] : [];
  });
}

/** Cadenas literales del archivo (sin comentarios) que contienen una clase `badge` o `b-<estado>`. */
function usosDeBadge(ruta: string): string[] {
  const sinComentarios = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const literales = sinComentarios.match(/(["'`])(?:(?!\1)[^\\\r\n]|\\.)*\1/g) ?? [];
  return literales.filter((literal) => /(?<![\w-])(badge|b-[a-z-]+)(?![\w-])/.test(literal));
}

/** Los únicos lugares donde se pinta un estado: pedido (BadgeEstado + mapa de clases) y pago aprobado. */
const PERMITIDOS = ['entities/pedido/model/estados.ts', 'entities/pedido/ui/badge-estado.tsx', 'pages/pago-pedido/ui/vistas-pago.tsx'];
const SELECTORES_DE_ESTADO = new Set(['.badge', '.b-pendiente', '.b-confirmado', '.b-en-prep', '.b-en-camino', '.b-entregado', '.b-cancelado', '.b-neutro', '.b-aprobado']);

describe('badges solo para estados (spec frontend-visual-language, «Badges solo para estados»)', () => {
  it('ningún componente usa clases badge/b-* fuera de estado de pedido y de pago', () => {
    const infractores = fuentes(SRC)
      .map((ruta) => relative(SRC, ruta).split(sep).join('/'))
      .filter((ruta) => !PERMITIDOS.includes(ruta))
      .filter((ruta) => usosDeBadge(join(SRC, ruta)).length > 0);

    expect(infractores).toEqual([]);
  });

  it('los archivos permitidos sí declaran el badge de estado (el escaneo funciona)', () => {
    for (const ruta of PERMITIDOS) expect(usosDeBadge(join(SRC, ruta)).length, ruta).toBeGreaterThan(0);
  });

  it('los CSS solo definen badges de estado (sin b-principal, b-rol, b-vos, b-alergeno, b-neutral ni badge-rol)', () => {
    const sobrantes = reglasDeSrc()
      .map((regla) => regla.selector.match(/\.(?:badge|b-[a-z-]+|badge-rol)(?![\w-])/g) ?? [])
      .flat()
      .filter((selector) => !SELECTORES_DE_ESTADO.has(selector));

    expect([...new Set(sobrantes)]).toEqual([]);
  });
});
