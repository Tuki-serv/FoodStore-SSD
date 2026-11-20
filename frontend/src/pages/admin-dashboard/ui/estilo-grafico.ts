/** Preferencia del sistema: con movimiento reducido los gráficos no se animan. */
export const MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';

/** Pantallas angostas (mobile): los gráficos pasan a barras horizontales. */
export const PANTALLA_ANGOSTA = '(max-width: 719.98px)';

/** Texto de los ejes, con los tokens del design system. */
export const TICK_EJE = { fontSize: 11, fontWeight: 500, fill: 'var(--color-text-muted)' } as const;

/** Rótulo de las categorías (nombres de producto o de estado). */
export const TICK_CATEGORIA = { fontSize: 13, fontWeight: 600, fill: 'var(--color-text)' } as const;
