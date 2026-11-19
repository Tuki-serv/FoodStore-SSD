const REGEX_DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** Centavos de un decimal con hasta 2 decimales (`"1250.50"` → 125050); `null` si no es un importe válido. */
export function aCentavos(decimal: string): number | null {
  const coincidencia = REGEX_DECIMAL.exec(decimal);
  if (coincidencia === null) return null;
  return Number(coincidencia[1]) * 100 + Number((coincidencia[2] ?? '').padEnd(2, '0'));
}

/** Decimal con dos decimales de una cantidad entera de centavos (`125050` → `"1250.50"`). */
export function formatearCentavos(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

/** Suma importes decimales en centavos enteros (sin aritmética de coma flotante); un importe inválido cuenta como cero. */
export function sumarImportes(...importes: readonly string[]): string {
  return formatearCentavos(importes.reduce((total, importe) => total + (aCentavos(importe) ?? 0), 0));
}
