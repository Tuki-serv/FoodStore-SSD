/** Seguimiento del pago pendiente (OQ-2): se consulta cada 5 s y se deja de hacerlo a los 2 min. */
export const INTERVALO_SEGUIMIENTO_MS = 5000;
export const TOPE_SEGUIMIENTO_MS = 120000;

/** Intervalo de `refetchInterval` para el último intento: solo un pago `pendiente` dentro del tope se sigue consultando. */
export function intervaloSeguimiento(estado: string | null | undefined, agotado: boolean): number | false {
  return estado === 'pendiente' && !agotado ? INTERVALO_SEGUIMIENTO_MS : false;
}
