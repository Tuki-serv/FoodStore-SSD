import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { Agrupacion, RangoEstadisticas } from '../model';
import { obtenerIngresos, obtenerPedidosPorEstado, obtenerProductosTop, obtenerResumen, obtenerVentas } from './estadisticas-api';

/** Los reportes cambian con cada venta, pero un minuto alcanza para un tablero que se actualiza a mano. */
const STALE_TIME_MS = 60_000;

const comunes = { staleTime: STALE_TIME_MS, placeholderData: keepPreviousData } as const;

/**
 * Consultas del dashboard: una por reporte, con clave `['estadisticas', reporte, parámetros]` (privada de la sesión).
 * Cada período se cachea aparte; al cambiar de período se sigue viendo el anterior mientras llega el nuevo.
 */
export const estadisticaQueries = {
  resumen: (rango: RangoEstadisticas) =>
    queryOptions({ queryKey: ['estadisticas', 'resumen', rango] as const, queryFn: () => obtenerResumen(rango), ...comunes }),
  ventas: (rango: RangoEstadisticas, agrupacion: Agrupacion) =>
    queryOptions({ queryKey: ['estadisticas', 'ventas', { ...rango, agrupacion }] as const, queryFn: () => obtenerVentas(rango, agrupacion), ...comunes }),
  productosTop: (rango: RangoEstadisticas) =>
    queryOptions({ queryKey: ['estadisticas', 'productos-top', rango] as const, queryFn: () => obtenerProductosTop(rango), ...comunes }),
  pedidosPorEstado: (rango: RangoEstadisticas) =>
    queryOptions({ queryKey: ['estadisticas', 'pedidos-por-estado', rango] as const, queryFn: () => obtenerPedidosPorEstado(rango), ...comunes }),
  ingresos: (rango: RangoEstadisticas) =>
    queryOptions({ queryKey: ['estadisticas', 'ingresos', rango] as const, queryFn: () => obtenerIngresos(rango), ...comunes }),
};
