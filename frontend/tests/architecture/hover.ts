import postcss from 'postcss';
import type { AtRule, Rule } from 'postcss';

const SOLO_CON_HOVER = /\(\s*hover\s*:\s*hover\s*\)/;

function dentroDeMediaHover(regla: Rule): boolean {
  let padre = regla.parent;
  while (padre !== undefined && padre.type !== 'root') {
    if (padre.type === 'atrule' && (padre as AtRule).name === 'media' && SOLO_CON_HOVER.test((padre as AtRule).params)) return true;
    padre = padre.parent;
  }
  return false;
}

/** Selectores con `:hover` que no están dentro de `@media (hover: hover)`: en táctil dejarían el estado pegado. */
export function selectoresHoverSueltos(css: string): string[] {
  const sueltos: string[] = [];
  postcss.parse(css).walkRules((regla) => {
    if (/:hover\b/.test(regla.selector) && !dentroDeMediaHover(regla)) sueltos.push(regla.selector);
  });
  return sueltos;
}
