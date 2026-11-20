/** Agrupación de la serie de ventas (parámetro `agrupacion` del backend). */
export type Agrupacion = 'day' | 'week' | 'month';

/** Rango de fechas `YYYY-MM-DD` inclusivo, en UTC como el backend. */
export interface RangoEstadisticas {
  desde: string;
  hasta: string;
}

export type AtajoPeriodo = 'hoy' | '7d' | '30d' | 'mes';

/** Por qué un rango no se puede pedir: `desde` posterior a `hasta`, o más de 366 días (el backend rechaza ambos con 422). */
export type ErrorRango = 'invertido' | 'largo';

/** Máximo de días de diferencia entre `desde` y `hasta` que acepta el backend. */
export const MAX_DIAS_RANGO = 366;

const MS_DIA = 86_400_000;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const REGEX_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

const aMs = (fecha: string): number => {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};
const aIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const sumarDias = (fecha: string, dias: number): string => aIso(aMs(fecha) + dias * MS_DIA);

/** Fecha de hoy en UTC (`YYYY-MM-DD`), coherente con el backend y con los filtros de pedidos. */
export const hoyUtc = (): string => new Date().toISOString().slice(0, 10);

/** `true` si el texto es una fecha `YYYY-MM-DD` que existe en el calendario. */
export function esFechaIso(valor: string): boolean {
  const coincidencia = REGEX_FECHA.exec(valor);
  return coincidencia !== null && aIso(aMs(valor)) === valor;
}

/** Rango del atajo respecto de `hoy`: «Hoy», últimos 7 o 30 días (contando hoy) y «Este mes» (desde el día 1). */
export function rangoAtajo(atajo: AtajoPeriodo, hoy: string): RangoEstadisticas {
  switch (atajo) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'mes':
      return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  }
}

/** Período sin parámetros en la URL: últimos 30 días. */
export const rangoPorDefecto = (hoy: string): RangoEstadisticas => rangoAtajo('30d', hoy);

const ATAJOS: readonly AtajoPeriodo[] = ['hoy', '7d', '30d', 'mes'];

/** Atajo cuyo rango coincide exactamente con el dado (el primero, en el orden de la pantalla), o `null` si es personalizado. */
export function atajoDe(rango: RangoEstadisticas, hoy: string): AtajoPeriodo | null {
  return ATAJOS.find((atajo) => {
    const candidato = rangoAtajo(atajo, hoy);
    return candidato.desde === rango.desde && candidato.hasta === rango.hasta;
  }) ?? null;
}

/** `null` si el rango se puede pedir; si no, el motivo. Espeja la validación del backend (fechas ya válidas). */
export function validarRango(desde: string, hasta: string): ErrorRango | null {
  const diferencia = (aMs(hasta) - aMs(desde)) / MS_DIA;
  if (diferencia < 0) return 'invertido';
  // Extremos inclusivos (igual que el backend): el rango abarca diferencia + 1 días.
  return diferencia + 1 > MAX_DIAS_RANGO ? 'largo' : null;
}

/** Rótulo del eje temporal: día `dd/mm`, semana «Sem. dd/mm» (inicio de semana) y mes «nov 2026». */
export function rotuloPeriodo(fecha: string, agrupacion: Agrupacion): string {
  const ddmm = `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
  if (agrupacion === 'week') return `Sem. ${ddmm}`;
  if (agrupacion === 'month') return `${MESES[Number(fecha.slice(5, 7)) - 1] ?? ''} ${fecha.slice(0, 4)}`;
  return ddmm;
}
