import { aCentavos } from '@/shared/lib';

/** Monto numérico para el brick a partir del total decimal en texto (`"2850.00"` → `2850`), pasando por centavos enteros. */
export function montoDesdeTotal(total: string): number {
  return (aCentavos(total) ?? 0) / 100;
}
