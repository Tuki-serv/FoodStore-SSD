import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { posix, sep } from 'node:path';

/** Capas FSD de mayor a menor: una capa solo importa de las que están después en la lista. */
const CAPAS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'] as const;
type Capa = (typeof CAPAS)[number];

/** `app` y `shared` no tienen slices: se organizan en segmentos (shared) o libremente (app). */
const CAPAS_CON_SLICES: readonly Capa[] = ['pages', 'widgets', 'features', 'entities'];

export interface ArchivoFuente {
  /** Ruta relativa a `src/`, con `/` como separador (p. ej. `pages/home/ui/home.tsx`). */
  ruta: string;
  contenido: string;
}

const REGEX_DESDE = /(?:import|export)\s[^'"`;]*?from\s*(['"])(.+?)\1/g;
const REGEX_EFECTO = /(?:^|[\s;])import\s*(['"])(.+?)\1/g;
const REGEX_DINAMICO = /\bimport\(\s*(['"`]?)([^'"`)]*)/g;

function esCapa(valor: string | undefined): valor is Capa {
  return CAPAS.some((capa) => capa === valor);
}

/** Especificadores literales y cantidad de `import()` no literales de un archivo. */
function extraerImports(contenido: string): { especificadores: string[]; dinamicosNoLiterales: number } {
  const especificadores: string[] = [];
  for (const regex of [REGEX_DESDE, REGEX_EFECTO]) {
    for (const coincidencia of contenido.matchAll(regex)) {
      if (coincidencia[2] !== undefined) especificadores.push(coincidencia[2]);
    }
  }
  let dinamicosNoLiterales = 0;
  for (const coincidencia of contenido.matchAll(REGEX_DINAMICO)) {
    const comilla = coincidencia[1];
    const cuerpo = coincidencia[2] ?? '';
    if (comilla === "'" || comilla === '"') especificadores.push(cuerpo);
    else dinamicosNoLiterales += 1;
  }
  return { especificadores, dinamicosNoLiterales };
}

function contenedorDe(segmentos: string[]): string[] {
  // Dentro de pages/<slice>, shared/<segmento> o app/ los imports relativos no pueden salir.
  return segmentos[0] === 'app' ? ['app'] : segmentos.slice(0, 2);
}

function motivoRelativo(ruta: string, especificador: string): string | null {
  const destino = posix.normalize(posix.join(posix.dirname(ruta), especificador)).split('/');
  const contenedor = contenedorDe(ruta.split('/'));
  const dentro = contenedor.every((segmento, i) => destino[i] === segmento);
  return dentro ? null : 'relativo fuera del slice';
}

function motivoAlias(ruta: string, especificador: string): string | null {
  const propio = ruta.split('/');
  const destino = especificador.slice(2).split('/');
  const capaPropia = propio[0];
  const capaDestino = destino[0];
  if (!esCapa(capaPropia) || !esCapa(capaDestino)) return null;

  const diferencia = CAPAS.indexOf(capaDestino) - CAPAS.indexOf(capaPropia);
  if (diferencia < 0) return `capa superior (${capaPropia} no puede importar ${capaDestino})`;

  const mismaCapa = diferencia === 0;
  const sliced = CAPAS_CON_SLICES.includes(capaDestino);
  if (mismaCapa && sliced && destino[1] !== propio[1]) {
    return `cross-import entre slices de ${capaPropia}`;
  }
  const mismoContenedor = mismaCapa && destino[1] === propio[1];
  if (mismoContenedor || capaDestino === 'app') return null;
  if (destino.length > 2) return `import profundo (usar '@/${destino.slice(0, 2).join('/')}')`;
  return null;
}

/** Devuelve, ordenadas, las violaciones de las fronteras FSD de los archivos dados. Lista vacía = todo bien. */
export function violacionesFsd(archivos: readonly ArchivoFuente[]): string[] {
  const violaciones: string[] = [];
  for (const { ruta, contenido } of archivos) {
    if (!esCapa(ruta.split('/')[0])) continue;
    const { especificadores, dinamicosNoLiterales } = extraerImports(contenido);
    if (dinamicosNoLiterales > 0) violaciones.push(`${ruta}: import dinámico no literal`);
    for (const especificador of especificadores) {
      let motivo: string | null = null;
      if (especificador.startsWith('.')) motivo = motivoRelativo(ruta, especificador);
      else if (especificador.startsWith('@/')) motivo = motivoAlias(ruta, especificador);
      if (motivo) violaciones.push(`${ruta}: '${especificador}' -> ${motivo}`);
    }
  }
  return violaciones.sort();
}

/** Capas donde cada carpeta de primer nivel es un slice (o, en `shared`, un segmento) con API pública obligatoria. */
const CAPAS_CON_API_PUBLICA: readonly Capa[] = ['pages', 'widgets', 'features', 'entities', 'shared'];

/**
 * Carpetas `capa/slice` (o `shared/segmento`) que tienen archivos pero ningún `index.ts`/`index.tsx` en su raíz:
 * sin él no hay API pública a la que apuntar los imports. Devuelve las rutas ordenadas; lista vacía = todo bien.
 */
export function slicesSinApiPublica(archivos: readonly ArchivoFuente[]): string[] {
  const carpetas = new Set<string>();
  const conIndice = new Set<string>();
  for (const { ruta } of archivos) {
    const segmentos = ruta.split('/');
    const [capa, slice, ...resto] = segmentos;
    if (!esCapa(capa) || !CAPAS_CON_API_PUBLICA.includes(capa) || slice === undefined || resto.length === 0) continue;
    const carpeta = `${capa}/${slice}`;
    carpetas.add(carpeta);
    if (resto.length === 1 && /^index\.tsx?$/.test(resto[0] ?? '')) conIndice.add(carpeta);
  }
  return [...carpetas].filter((carpeta) => !conIndice.has(carpeta)).sort();
}

/** Lee recursivamente los `.ts`/`.tsx` de un directorio; `sufijo` (p. ej. `.fixture`) se quita de la ruta. */
export function leerArbol(raiz: URL, sufijo = ''): ArchivoFuente[] {
  const base = fileURLToPath(raiz).split(sep).join('/').replace(/\/$/, '');
  const archivos: ArchivoFuente[] = [];
  const recorrer = (directorio: string): void => {
    for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
      const completa = `${directorio}/${entrada.name}`;
      if (entrada.isDirectory()) {
        recorrer(completa);
        continue;
      }
      if (!entrada.name.endsWith(sufijo)) continue;
      const sinSufijo = completa.slice(0, completa.length - sufijo.length);
      if (!/\.tsx?$/.test(sinSufijo)) continue;
      archivos.push({ ruta: sinSufijo.slice(base.length + 1), contenido: readFileSync(completa, 'utf8') });
    }
  };
  recorrer(base);
  return archivos;
}
