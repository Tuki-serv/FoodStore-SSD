import { esEstadoPedido, esEstadoTerminal, type EstadoPedidoCodigo, type PedidoResumen } from '@/entities/pedido';

/** Pedidos por página: los de un cliente son pocos y las tarjetas en mobile son altas (design D4). */
export const TAMANO_PAGINA = 10;

/** Filtro tal como vive en la URL (`?estado=&page=`); `estado` `null` = «Todos». */
export interface FiltroMisPedidos {
  estado: EstadoPedidoCodigo | null;
  page: number;
}

function paginaValida(valor: string | null): number {
  const numero = Number(valor);
  return valor !== null && valor !== '' && Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

/** Lee el filtro de la URL; cualquier valor inválido vuelve al valor por defecto. */
export function leerFiltroMisPedidos(parametros: URLSearchParams): FiltroMisPedidos {
  const estado = parametros.get('estado');
  return { estado: esEstadoPedido(estado) ? estado : null, page: paginaValida(parametros.get('page')) };
}

/** Parámetros de URL de un filtro: los valores por defecto no dejan rastro. */
export function aParametros({ estado, page }: FiltroMisPedidos): Record<string, string> {
  return { ...(estado === null ? {} : { estado }), ...(page > 1 ? { page: String(page) } : {}) };
}

/** El listado se vuelve a pedir solo mientras algún pedido de la página siga en curso (design D9). */
export function debeActualizarLista(pedidos: readonly Pick<PedidoResumen, 'estado_codigo'>[] | undefined): boolean {
  return pedidos !== undefined && pedidos.some((pedido) => !esEstadoTerminal(pedido.estado_codigo));
}
