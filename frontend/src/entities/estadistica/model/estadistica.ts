import type { Agrupacion, RangoEstadisticas } from './periodo';

/** `GET /estadisticas/resumen`: ventas e ingresos del rango; `pedidos_activos` es de ahora, sin importar el rango. Importes en texto decimal. */
export interface ResumenVentas {
  ventas: number;
  ingresos: string;
  ticket_promedio: string;
  pedidos_activos: number;
}

/** Un período de la serie de ventas: `fecha` es el inicio del período (`YYYY-MM-DD`); los períodos sin ventas vienen con 0. */
export interface PuntoVentas {
  fecha: string;
  total_ventas: string;
  cantidad_pedidos: number;
}

export interface ProductoTop {
  producto_id: number;
  nombre: string;
  cantidad_vendida: number;
  /** Suma de los subtotales de línea del producto («facturado en el producto»). */
  ingresos: string;
}

/** Cantidad de pedidos en un estado; llegan los seis, en el orden de la FSM. */
export interface PedidosEstado {
  estado_codigo: string;
  cantidad: number;
}

/** Ingresos de una forma de pago del catálogo (con "0.00" si no tuvo ventas). */
export interface IngresoFormaPago {
  forma_pago_codigo: string;
  total: string;
  cantidad: number;
}

export type { Agrupacion, RangoEstadisticas };
