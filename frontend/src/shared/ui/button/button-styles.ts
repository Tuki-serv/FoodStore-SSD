export type VarianteBoton = 'primario' | 'secundario';

const BASE =
  'inline-flex min-h-tap items-center justify-center gap-2 rounded-md border-2 px-5 font-bold no-underline cursor-pointer ' +
  'transition-[background-color,transform] duration-fast ease-out active:scale-[.97] focus-visible:outline-none focus-visible:shadow-focus';

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'border-transparent bg-primary text-white hover:bg-primary-hover',
  secundario: 'border-primary bg-surface text-primary-hover hover:bg-primary-soft',
};

/** Clases de botón del design system (components.html) para `<button>` o `<a>`: una sola definición para todas las páginas. */
export function claseBoton(variante: VarianteBoton): string {
  return `${BASE} ${VARIANTES[variante]}`;
}
