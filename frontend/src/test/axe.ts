import axe from 'axe-core';

/**
 * Falla si axe-core encuentra violaciones de accesibilidad en `contenedor`.
 * `color-contrast` va desactivada: jsdom no calcula estilos reales (el contraste lo valida el design system).
 */
export async function esperarSinViolacionesA11y(contenedor: Element): Promise<void> {
  const { violations } = await axe.run(contenedor, { rules: { 'color-contrast': { enabled: false } } });
  if (violations.length === 0) return;
  const detalle = violations
    .map((violacion) => `${violacion.id}: ${violacion.help} (${violacion.nodes.map((nodo) => nodo.target.join(' ')).join('; ')})`)
    .join('\n');
  throw new Error(`Violaciones de accesibilidad:\n${detalle}`);
}
