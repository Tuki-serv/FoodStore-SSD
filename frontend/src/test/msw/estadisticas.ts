import { delay, http, HttpResponse } from 'msw';
import type { IngresoFormaPago, PedidosEstado, ProductoTop, PuntoVentas, ResumenVentas } from '@/entities/estadistica';
import { respuestaError } from './admin-catalogo';
import { API } from './server';

/** Los cinco reportes de `/estadisticas/*`, con el nombre de su path. */
export type Reporte = 'resumen' | 'ventas' | 'productos-top' | 'pedidos-por-estado' | 'ingresos';

export const REPORTES: readonly Reporte[] = ['resumen', 'ventas', 'productos-top', 'pedidos-por-estado', 'ingresos'];

/** Pedido recibido: reporte y query string tal como llegó (`?desde=…&hasta=…`). */
export interface PedidoEstadisticas {
  reporte: Reporte;
  busqueda: string;
}

/** Qué hace un reporte en lugar de responder datos: un status HTTP de error o red caída. */
export type Falla = number | 'red';

/** Estado en memoria de la red de estadísticas; los tests lo mutan para cambiar datos, demoras o fallas. */
export interface EstadoEstadisticas {
  resumen: ResumenVentas;
  ventas: PuntoVentas[];
  productosTop: ProductoTop[];
  pedidosPorEstado: PedidosEstado[];
  ingresos: IngresoFormaPago[];
  pedidos: PedidoEstadisticas[];
  fallas: Partial<Record<Reporte, Falla>>;
  /** Demora (ms) por reporte, para ver esqueletos y actualizaciones en curso. */
  demoras: Partial<Record<Reporte, number>>;
}

const CANTIDAD_POR_ESTADO: readonly PedidosEstado[] = [
  { estado_codigo: 'PENDIENTE', cantidad: 2 },
  { estado_codigo: 'CONFIRMADO', cantidad: 1 },
  { estado_codigo: 'EN_PREP', cantidad: 3 },
  { estado_codigo: 'EN_CAMINO', cantidad: 0 },
  { estado_codigo: 'ENTREGADO', cantidad: 4 },
  { estado_codigo: 'CANCELADO', cantidad: 1 },
];

/** Datos de la spec: 3 días con una venta de 1000 el 10/11; ranking de 3 productos; `EN_PREP` con 3; efectivo 1500 y Mercado Pago 500. */
export function crearEstadoEstadisticas(): EstadoEstadisticas {
  return {
    resumen: { ventas: 3, ingresos: '4500.00', ticket_promedio: '1500.00', pedidos_activos: 2 },
    ventas: [
      { fecha: '2026-11-09', total_ventas: '0.00', cantidad_pedidos: 0 },
      { fecha: '2026-11-10', total_ventas: '1000.00', cantidad_pedidos: 1 },
      { fecha: '2026-11-11', total_ventas: '0.00', cantidad_pedidos: 0 },
    ],
    productosTop: [
      { producto_id: 11, nombre: 'Empanada de carne', cantidad_vendida: 8, ingresos: '2400.00' },
      { producto_id: 12, nombre: 'Pizza muzzarella', cantidad_vendida: 5, ingresos: '5000.00' },
      { producto_id: 13, nombre: 'Tarta de verdura', cantidad_vendida: 2, ingresos: '1800.00' },
    ],
    pedidosPorEstado: CANTIDAD_POR_ESTADO.map((estado) => ({ ...estado })),
    ingresos: [
      { forma_pago_codigo: 'EFECTIVO', total: '1500.00', cantidad: 1 },
      { forma_pago_codigo: 'MERCADOPAGO', total: '500.00', cantidad: 1 },
      { forma_pago_codigo: 'TRANSFERENCIA', total: '0.00', cantidad: 0 },
    ],
    pedidos: [],
    fallas: {},
    demoras: {},
  };
}

/** Un período sin ventas: serie con ceros, ranking vacío, seis estados en 0 y las tres formas de pago en "0.00" (como responde el backend). */
export function crearEstadoSinVentas(): EstadoEstadisticas {
  const base = crearEstadoEstadisticas();
  return {
    ...base,
    resumen: { ventas: 0, ingresos: '0.00', ticket_promedio: '0.00', pedidos_activos: 2 },
    ventas: base.ventas.map((punto) => ({ ...punto, total_ventas: '0.00', cantidad_pedidos: 0 })),
    productosTop: [],
    pedidosPorEstado: base.pedidosPorEstado.map((estado) => ({ ...estado, cantidad: 0 })),
    ingresos: base.ingresos.map((forma) => ({ ...forma, total: '0.00', cantidad: 0 })),
  };
}

/** Pedidos registrados de un reporte, en orden de llegada. */
export const pedidosDe = (estado: EstadoEstadisticas, reporte: Reporte): PedidoEstadisticas[] => estado.pedidos.filter((pedido) => pedido.reporte === reporte);

/**
 * Handlers de `GET /estadisticas/{reporte}`: registran el query string, aplican la demora y la falla inyectada del reporte
 * (status de error o red caída) y, si no hay falla, devuelven los datos del estado.
 */
export function handlersEstadisticas(estado: EstadoEstadisticas) {
  const datos = (reporte: Reporte): ResumenVentas | PuntoVentas[] | ProductoTop[] | PedidosEstado[] | IngresoFormaPago[] => {
    switch (reporte) {
      case 'resumen':
        return estado.resumen;
      case 'ventas':
        return estado.ventas;
      case 'productos-top':
        return estado.productosTop;
      case 'pedidos-por-estado':
        return estado.pedidosPorEstado;
      case 'ingresos':
        return estado.ingresos;
    }
  };
  return REPORTES.map((reporte) =>
    http.get(`${API}/estadisticas/${reporte}`, async ({ request }) => {
      estado.pedidos.push({ reporte, busqueda: new URL(request.url).search });
      const demora = estado.demoras[reporte];
      if (demora !== undefined) await delay(demora);
      const falla = estado.fallas[reporte];
      if (falla === 'red') return HttpResponse.error();
      if (falla !== undefined) return respuestaError(falla, `HTTP_${String(falla)}`, 'Error del servidor');
      return HttpResponse.json(datos(reporte));
    }),
  );
}
