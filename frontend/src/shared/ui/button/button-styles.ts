export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro';

const BASE =
  'inline-flex min-h-tap items-center justify-center gap-2 rounded-md border-2 px-5 font-bold no-underline cursor-pointer ' +
  'transition-[background-color,transform] duration-fast ease-out active:scale-[.97] focus-visible:outline-none focus-visible:shadow-focus ' +
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-alt disabled:text-text-muted disabled:active:scale-100';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'border-transparent bg-primary text-white hover:bg-primary-hover',
  secundario: 'border-primary bg-surface text-primary-hover hover:bg-primary-soft',
  fantasma: 'border-transparent bg-transparent text-text hover:bg-surface-alt',
  peligro: 'border-transparent bg-danger text-white',
};

/** Tamaño compacto (acciones dentro de listados): 36 px de alto, texto chico. */
const COMPACTO = 'min-h-[36px] px-3 text-sm';

/** Clases de botón del design system (components.html) para `<button>` o `<a>`: una sola definición para todas las páginas. */
export function claseBoton(variante: VarianteBoton, { compacto = false }: { compacto?: boolean } = {}): string {
  return `${BASE} ${VARIANTES[variante]}${compacto ? ` ${COMPACTO}` : ''}`;
}
