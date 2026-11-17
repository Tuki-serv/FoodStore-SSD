import type { ReactElement } from 'react';

/** Trazos de cada ícono (viewBox 24x24), trasladados del sprite de `design-system/components.html` (+ 3 de los mockups de C-13a). */
const TRAZOS = {
  catalogo: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  carrito: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.7 11.4a1.5 1.5 0 0 0 1.5 1.1h8.3a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6" />
    </>
  ),
  pedidos: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  direcciones: (
    <>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  cuenta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  gestion: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
    </>
  ),
  categorias: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  ingredientes: (
    <>
      <path d="M6 18C6 9 11 5 20 4c0 9-4 14-13 14" />
      <path d="M4 21c2-5 5-8 10-11" />
    </>
  ),
  productos: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20a7 7 0 0 1 14 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.6A7 7 0 0 1 22 20" />
    </>
  ),
  dashboard: <path d="M5 20V11M11 20V4M17 20v-6M2 20h20" />,
  ingresar: (
    <>
      <path d="M14 3h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-5" />
      <path d="M4 12h11M11 8l4 4-4 4" />
    </>
  ),
  registrarse: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21a8 8 0 0 1 13-6.2" />
      <path d="M19 14v6M16 17h6" />
    </>
  ),
  salir: (
    <>
      <path d="M10 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5" />
      <path d="M9 12h11M16 8l4 4-4 4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
  brujula: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 3l9.5 17h-19z" />
      <path d="M12 10v4M12 17.5v.01" />
    </>
  ),
  obra: (
    <>
      <path d="M3 20h18M5 20l3-12h8l3 12" />
      <path d="M7 14h10M9.5 8V5h5v3" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof TRAZOS;

export const ICON_NAMES = Object.keys(TRAZOS) as IconName[];

export interface IconProps {
  name: IconName;
  /** Clases extra (utilidades de Tailwind) para tamaño o color; el trazo base `ico` siempre se aplica. */
  className?: string;
}

/** Ícono decorativo (`aria-hidden`): el nombre accesible lo da el botón o enlace que lo contiene. */
export function Icon({ name, className }: IconProps): ReactElement {
  return (
    <svg className={className === undefined ? 'ico' : `ico ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon={name}>
      {TRAZOS[name]}
    </svg>
  );
}
