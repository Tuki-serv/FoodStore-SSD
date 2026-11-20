import { esFechaIso, rangoPorDefecto, validarRango, type Agrupacion, type RangoEstadisticas } from '@/entities/estadistica';

/** Período del dashboard tal como vive en la URL (`?desde=&hasta=&agrupacion=`). */
export interface PeriodoDashboard {
  rango: RangoEstadisticas;
  agrupacion: Agrupacion;
}

const AGRUPACION_POR_DEFECTO: Agrupacion = 'day';
const AGRUPACIONES: readonly Agrupacion[] = ['day', 'week', 'month'];

const esAgrupacion = (valor: string | null): valor is Agrupacion => AGRUPACIONES.some((agrupacion) => agrupacion === valor);

/**
 * Lee el período de la URL. Cualquier valor inválido vuelve a su defecto (últimos 30 días por día) sin error visible:
 * las fechas se toman juntas (una sola inválida, un rango invertido o de más de un año reemplazan el rango entero).
 */
export function leerPeriodo(parametros: URLSearchParams, hoy: string): PeriodoDashboard {
  const desde = parametros.get('desde') ?? '';
  const hasta = parametros.get('hasta') ?? '';
  const agrupacion = parametros.get('agrupacion');
  const rangoValido = esFechaIso(desde) && esFechaIso(hasta) && validarRango(desde, hasta) === null;
  return {
    rango: rangoValido ? { desde, hasta } : rangoPorDefecto(hoy),
    agrupacion: esAgrupacion(agrupacion) ? agrupacion : AGRUPACION_POR_DEFECTO,
  };
}

/** Parámetros de URL de un período: el rango por defecto y la agrupación «día» no dejan rastro. */
export function aParametros({ rango, agrupacion }: PeriodoDashboard, hoy: string): Record<string, string> {
  const porDefecto = rangoPorDefecto(hoy);
  const esRangoPorDefecto = rango.desde === porDefecto.desde && rango.hasta === porDefecto.hasta;
  return {
    ...(esRangoPorDefecto ? {} : { desde: rango.desde, hasta: rango.hasta }),
    ...(agrupacion === AGRUPACION_POR_DEFECTO ? {} : { agrupacion }),
  };
}
