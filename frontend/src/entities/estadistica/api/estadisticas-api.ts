import { apiClient } from '@/shared/api';
import type { Agrupacion, IngresoFormaPago, PedidosEstado, ProductoTop, PuntoVentas, RangoEstadisticas, ResumenVentas } from '../model';

/** Tamaño del ranking de productos que muestra el dashboard (el backend acepta 1 a 20). */
export const LIMITE_PRODUCTOS_TOP = 5;

/** `GET /estadisticas/resumen` (solo `ADMIN`): ventas, ingresos y ticket del rango, y pedidos activos de ahora. */
export async function obtenerResumen({ desde, hasta }: RangoEstadisticas): Promise<ResumenVentas> {
  const { data } = await apiClient.get<ResumenVentas>('/estadisticas/resumen', { params: { desde, hasta } });
  return data;
}

/** `GET /estadisticas/ventas`: un elemento por período del rango (con 0 si no hubo ventas), agrupado por día, semana o mes. */
export async function obtenerVentas({ desde, hasta }: RangoEstadisticas, agrupacion: Agrupacion): Promise<PuntoVentas[]> {
  const { data } = await apiClient.get<PuntoVentas[]>('/estadisticas/ventas', { params: { desde, hasta, agrupacion } });
  return data;
}

/** `GET /estadisticas/productos-top`: los productos más vendidos del rango, por cantidad. */
export async function obtenerProductosTop({ desde, hasta }: RangoEstadisticas): Promise<ProductoTop[]> {
  const { data } = await apiClient.get<ProductoTop[]>('/estadisticas/productos-top', { params: { desde, hasta, limit: LIMITE_PRODUCTOS_TOP } });
  return data;
}

/** `GET /estadisticas/pedidos-por-estado`: los seis estados en el orden de la FSM (con 0 los que no tienen pedidos). */
export async function obtenerPedidosPorEstado({ desde, hasta }: RangoEstadisticas): Promise<PedidosEstado[]> {
  const { data } = await apiClient.get<PedidosEstado[]>('/estadisticas/pedidos-por-estado', { params: { desde, hasta } });
  return data;
}

/** `GET /estadisticas/ingresos`: ingresos y ventas por cada forma de pago del catálogo (con "0.00" si no hubo). */
export async function obtenerIngresos({ desde, hasta }: RangoEstadisticas): Promise<IngresoFormaPago[]> {
  const { data } = await apiClient.get<IngresoFormaPago[]>('/estadisticas/ingresos', { params: { desde, hasta } });
  return data;
}
