import { esEstadoPedido, type EstadoPedidoCodigo } from '@/entities/pedido';

/** Pedidos por página (el defecto del backend). */
export const TAMANO_PAGINA = 20;

export const MENSAJE_RANGO_INVERTIDO = 'La fecha "Desde" no puede ser posterior a "Hasta"';

/** Filtros tal como viven en la URL (`?estado=&desde=&hasta=&page=`); `null` / `''` = sin filtro. */
export interface FiltrosUrl {
  estado: EstadoPedidoCodigo | null;
  /** `YYYY-MM-DD` (día UTC del servidor) o `''`. */
  desde: string;
  hasta: string;
  page: number;
}

/** `YYYY-MM-DD` de un día que existe en el calendario; cualquier otra cosa es `''`. */
function fechaValida(valor: string | null): string {
  if (valor === null || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return '';
  const fecha = new Date(`${valor}T00:00:00Z`);
  return Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor ? '' : valor;
}

function paginaValida(valor: string | null): number {
  const numero = Number(valor);
  return valor !== null && valor !== '' && Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

/** Lee los filtros de la URL; cualquier valor inválido vuelve al valor por defecto. */
export function leerFiltrosPedidos(parametros: URLSearchParams): FiltrosUrl {
  const estado = parametros.get('estado');
  return {
    estado: esEstadoPedido(estado) ? estado : null,
    desde: fechaValida(parametros.get('desde')),
    hasta: fechaValida(parametros.get('hasta')),
    page: paginaValida(parametros.get('page')),
  };
}

/** Parámetros de URL de unos filtros: los valores por defecto no dejan rastro. */
export function aParametros({ estado, desde, hasta, page }: FiltrosUrl): Record<string, string> {
  return {
    ...(estado === null ? {} : { estado }),
    ...(desde === '' ? {} : { desde }),
    ...(hasta === '' ? {} : { hasta }),
    ...(page > 1 ? { page: String(page) } : {}),
  };
}

/** Mensaje de error si «Desde» es posterior a «Hasta»; `null` si el rango es válido o está incompleto. */
export function validarRango(desde: string, hasta: string): string | null {
  return desde !== '' && hasta !== '' && desde > hasta ? MENSAJE_RANGO_INVERTIDO : null;
}
