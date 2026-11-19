import { aCentavos, formatearCentavos } from '@/shared/lib';

/** Costo de envío fijo por pedido (DD-10). [PENDIENTE DE DECISIÓN: PA-11] reglas de envío; [PENDIENTE DE DECISIÓN: PA-13] ¿se cobra con retiro en el local? */
export const COSTO_ENVIO = '50.00';

/** Descuento por pedido (DD-10: sin reglas todavía). [PENDIENTE DE DECISIÓN: PA-11] */
export const DESCUENTO = '0.00';

/** Total estimado del checkout: subtotal + envío − descuento, en centavos enteros. El total final lo calcula el servidor. */
export function totalEstimado(subtotal: string): string {
  return formatearCentavos((aCentavos(subtotal) ?? 0) + (aCentavos(COSTO_ENVIO) ?? 0) - (aCentavos(DESCUENTO) ?? 0));
}
