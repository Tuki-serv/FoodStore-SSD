/** Número de un decimal en texto (`"1500.50"` → 1500.5) para los ejes del gráfico; algo que no es decimal vale 0. */
export function aNumero(decimal: string): number {
  const numero = Number(decimal);
  return Number.isFinite(numero) ? numero : 0;
}

/** Importe abreviado del eje de valores («$ 20 mil», «$ 1,2 M»); tooltips y tablas llevan el importe completo. */
export function importeCorto(valor: number): string {
  if (valor >= 1_000_000) return `$ ${String(valor / 1_000_000).replace('.', ',')} M`;
  if (valor >= 1000) return `$ ${String(valor / 1000).replace('.', ',')} mil`;
  return `$ ${String(valor)}`;
}

/** Porcentaje entero de cada importe sobre el total, repartido por resto mayor para que siempre sumen 100 (todo en cero → ceros). */
export function porcentajes(importes: readonly string[]): number[] {
  const centavos = importes.map((importe) => Math.round(aNumero(importe) * 100));
  const total = centavos.reduce((suma, valor) => suma + valor, 0);
  if (total === 0) return centavos.map(() => 0);
  const crudos = centavos.map((valor) => (valor * 100) / total);
  const base = crudos.map(Math.floor);
  const faltan = 100 - base.reduce((suma, valor) => suma + valor, 0);
  crudos
    .map((crudo, indice) => ({ indice, resto: crudo - Math.floor(crudo) }))
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice)
    .slice(0, faltan)
    .forEach(({ indice }) => {
      base[indice] = (base[indice] ?? 0) + 1;
    });
  return base;
}

/** Cantidad entera con separador de miles (`1234` → «1.234»), el mismo de los precios. */
export function formatearCantidad(cantidad: number): string {
  return String(cantidad).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
