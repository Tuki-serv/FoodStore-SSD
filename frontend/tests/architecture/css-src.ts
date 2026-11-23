import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postcss from 'postcss';

export interface ReglaPlana {
  selector: string;
  declaraciones: Record<string, string>;
}

/** Rutas de todos los `.css` bajo `directorio`. */
export function archivosCss(directorio: string): string[] {
  return readdirSync(directorio).flatMap((nombre) => {
    const ruta = join(directorio, nombre);
    return statSync(ruta).isDirectory() ? archivosCss(ruta) : ruta.endsWith('.css') ? [ruta] : [];
  });
}

/** Reglas de todos los CSS de `src/` (aplanando @layer/@media), una por selector de la lista, con sus declaraciones. */
export function reglasDeSrc(raiz = process.cwd()): ReglaPlana[] {
  const reglas: ReglaPlana[] = [];
  for (const ruta of archivosCss(resolve(raiz, 'src'))) {
    postcss.parse(readFileSync(ruta, 'utf8')).walkRules((regla) => {
      const declaraciones: Record<string, string> = {};
      regla.each((nodo) => {
        if (nodo.type === 'decl') declaraciones[nodo.prop] = nodo.value;
      });
      for (const selector of regla.selectors) reglas.push({ selector: selector.trim(), declaraciones });
    });
  }
  return reglas;
}
