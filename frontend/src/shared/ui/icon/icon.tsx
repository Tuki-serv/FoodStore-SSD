import type { ReactElement } from 'react';

/** Trazos de cada ícono (viewBox 24x24), trasladados del sprite de `design-system/components.html` (+ 3 de los mockups de C-13a `candado` de los de C-13b y `editar`, `basura`, `estrella`, `mas`, `tienda` de los de C-15; estos últimos faltan en el sprite de components.html; ticket, tabla, grafico y vacio, de los mockups de C-24). */
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
  candado: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" />
    </>
  ),
  editar: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  basura: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  estrella: <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
  mas: <path d="M12 5v14M5 12h14" />,
  tienda: (
    <>
      <path d="M4 10v10h16V10M3 10l2-6h14l2 6z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  filtros: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  menos: <path d="M5 12h14" />,
  guardar: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  volver: <path d="M19 12H5M11 6l-6 6 6 6" />,
  plato: (
    <>
      <circle cx="12" cy="13" r="6" />
      <circle cx="12" cy="13" r="3" />
      <path d="M2.5 4v4a1.5 1.5 0 0 0 3 0V4M4 8v12M21.5 4c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v7" />
    </>
  ),
  subcategoria: (
    <>
      <path d="M5 3v13a2 2 0 0 0 2 2h5" />
      <path d="M5 9h7" />
      <path d="M18 13v8M14 17h8" />
    </>
  ),
  alergeno: (
    <>
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
      <path d="M12 8v5M12 16.5v.01" />
    </>
  ),
  reintentar: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  tarjeta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  efectivo: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </>
  ),
  transferencia: (
    <>
      <path d="M4 8h14M14 4l4 4-4 4" />
      <path d="M20 16H6M10 12l-4 4 4 4" />
    </>
  ),
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8v.01" />
    </>
  ),
  exito: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.8" />
    </>
  ),
  moto: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M9 17h6l-3-7H8M15 10h3l2 7M12 7h3" />
    </>
  ),
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  nota: (
    <>
      <path d="M5 4h14v11l-5 5H5z" />
      <path d="M14 20v-5h5M9 9h6M9 13h3" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z" />
      <path d="M14 5v14" strokeDasharray="2 3" />
    </>
  ),
  tabla: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M10 4v16" />
    </>
  ),
  grafico: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15l4-5 3 3 5-7" />
    </>
  ),
  vacio: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="M8 15h12" strokeDasharray="2 3" />
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
