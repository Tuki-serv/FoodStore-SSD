import type { CSSProperties } from 'react';

/** Cantidad máxima de pasos del retardo: los elementos más allá del tope entran con el retardo máximo (design system: «max 8 steps»). */
export const TOPE_ESCALONADO = 8;

/** Clase del contenedor que escalona la entrada de sus hijos directos (`--i` por hijo, retardo con `--stagger-step`). */
export const CLASE_ENTRADA_ESCALONADA = 'stagger';

/** Estilo del hijo número `indice`: `--i` topado en `TOPE_ESCALONADO`. */
export function estiloEscalonado(indice: number): CSSProperties {
  return { '--i': String(Math.min(indice, TOPE_ESCALONADO)) } as CSSProperties;
}

/** Suma la clase de entrada a las clases base del contenedor solo si `primerMontaje`. */
export function claseEntradaEscalonada(primerMontaje: boolean, base = ''): string {
  return primerMontaje ? `${base} ${CLASE_ENTRADA_ESCALONADA}`.trim() : base;
}
