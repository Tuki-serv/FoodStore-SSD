export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'fantasmaPeligro' | 'peligro' | 'peligroContorno';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md border-2 font-bold no-underline cursor-pointer ' +
  'transition-[background-color,transform] duration-fast ease-out active:scale-[.97] focus-visible:outline-none focus-visible:shadow-focus ' +
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-alt disabled:text-text-muted disabled:active:scale-100';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'border-transparent bg-primary text-white hover:bg-primary-hover',
  secundario: 'border-primary bg-surface text-primary-hover hover:bg-primary-soft',
  fantasma: 'border-transparent bg-transparent text-text hover:bg-surface-alt',
  /** Acción destructiva discreta (por ejemplo, «Eliminar» en la fila de un listado). */
  fantasmaPeligro: 'border-transparent bg-transparent text-danger hover:bg-danger-bg',
  peligro: 'border-transparent bg-danger text-white',
  /** Acción destructiva visible pero secundaria (por ejemplo, «Cancelar pedido» junto a la acción principal). */
  peligroContorno: 'border-danger bg-surface text-danger hover:bg-danger-bg',
};

/** Tamaño normal: alto táctil y padding de 20 px. Va en lugar de `COMPACTO` (dos clases de tamaño juntas se pisan según el orden del CSS). */
const NORMAL = 'min-h-tap px-5';

/** Tamaño compacto (acciones dentro de listados): 36 px de alto, texto chico. */
const COMPACTO = 'min-h-[36px] px-3 text-sm';

/** Clases de botón del design system (components.html) para `<button>` o `<a>`: una sola definición para todas las páginas. */
export function claseBoton(variante: VarianteBoton, { compacto = false }: { compacto?: boolean } = {}): string {
  return `${BASE} ${VARIANTES[variante]} ${compacto ? COMPACTO : NORMAL}`;
}
