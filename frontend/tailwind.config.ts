import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * El tema solo referencia variables de `design-system/tokens.css` (única fuente visual).
 * Un test (`tests/architecture/tailwind-tokens.test.ts`) falla si aparece un valor literal
 * o una variable que no existe en ese archivo.
 */
const token = (nombre: string): string => `var(--${nombre})`;

const config: Config = {
  // `hover:` solo con puntero capaz de hover (`@media (hover: hover)`): sin estados pegados en táctil.
  future: { hoverOnlyWhenSupported: true },
  content: ['index.html', 'src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: token('color-primary'), hover: token('color-primary-hover'), soft: token('color-primary-soft') },
        accent: { DEFAULT: token('color-accent'), soft: token('color-accent-soft') },
        bg: token('color-bg'),
        surface: { DEFAULT: token('color-surface'), alt: token('color-surface-alt') },
        border: token('color-border'),
        text: { DEFAULT: token('color-text'), muted: token('color-text-muted') },
        overlay: token('color-overlay'),
        // Superficies por rol (Revision 4, D2): página, zona agrupada, objeto accionable y capa superior.
        'surface-page': token('surface-page'),
        'surface-section': token('surface-section'),
        'surface-raised': token('surface-raised'),
        'surface-overlay': token('surface-overlay'),
        success: { DEFAULT: token('color-success'), bg: token('color-success-bg') },
        warning: { DEFAULT: token('color-warning'), bg: token('color-warning-bg') },
        danger: { DEFAULT: token('color-danger'), bg: token('color-danger-bg') },
        info: { DEFAULT: token('color-info'), bg: token('color-info-bg') },
        'estado-pendiente': { fg: token('state-pendiente-fg'), bg: token('state-pendiente-bg') },
        'estado-confirmado': { fg: token('state-confirmado-fg'), bg: token('state-confirmado-bg') },
        'estado-en-prep': { fg: token('state-en-prep-fg'), bg: token('state-en-prep-bg') },
        'estado-en-camino': { fg: token('state-en-camino-fg'), bg: token('state-en-camino-bg') },
        'estado-entregado': { fg: token('state-entregado-fg'), bg: token('state-entregado-bg') },
        'estado-cancelado': { fg: token('state-cancelado-fg'), bg: token('state-cancelado-bg') },
      },
      fontFamily: {
        sans: [token('font-sans')],
        display: [token('font-display')],
        mono: [token('font-mono')],
      },
      fontSize: {
        xs: token('text-xs'),
        sm: token('text-sm'),
        base: token('text-base'),
        lg: token('text-lg'),
        xl: token('text-xl'),
        '2xl': token('text-2xl'),
        '3xl': token('text-3xl'),
      },
      lineHeight: {
        tight: token('leading-tight'),
        normal: token('leading-normal'),
      },
      spacing: {
        '1': token('space-1'),
        '2': token('space-2'),
        '3': token('space-3'),
        '4': token('space-4'),
        '5': token('space-5'),
        '6': token('space-6'),
        '7': token('space-7'),
        '8': token('space-8'),
        tap: token('tap-min'),
        sidebar: token('sidebar-width'),
        'sidebar-collapsed': token('sidebar-width-collapsed'),
        topbar: token('topbar-height'),
      },
      borderRadius: {
        sm: token('radius-sm'),
        md: token('radius-md'),
        lg: token('radius-lg'),
        pill: token('radius-pill'),
      },
      boxShadow: {
        sm: token('shadow-sm'),
        md: token('shadow-md'),
        lg: token('shadow-lg'),
        focus: token('focus-ring'),
      },
      transitionDuration: {
        fast: token('motion-fast'),
        base: token('motion-base'),
        slow: token('motion-slow'),
      },
      transitionDelay: {
        stagger: token('stagger-step'),
      },
      transitionTimingFunction: {
        out: token('ease-out'),
        'in-out': token('ease-in-out'),
        drawer: token('ease-drawer'),
      },
      scale: {
        press: token('press-scale'),
      },
      fontWeight: {
        display: token('weight-display'),
      },
      zIndex: {
        'page-header': token('z-page-header'),
        topbar: token('z-topbar'),
        scrim: token('z-scrim'),
        drawer: token('z-drawer'),
      },
    },
  },
  plugins: [
    // Numerales tabulares desde el token (Tailwind solo trae `tabular-nums` con valor literal).
    plugin(({ addUtilities }) => {
      addUtilities({ '.num-tabular': { 'font-variant-numeric': token('numeric-tabular') } });
    }),
  ],
};

export default config;
