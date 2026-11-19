import { crearEstadoPagos, handlersPagos, type EstadoPagos } from './msw/pagos';
import { crearEstadoPedidos, detalleDto, handlersPedidos, pedidoDto, type EstadoPedidos } from './msw/pedidos';
import { server } from './msw/server';
import { renderApp, type OpcionesApp } from './render-app';
import type { PedidoDetalle } from '@/entities/pedido';

/** Pedido 58 `MERCADOPAGO` `PENDIENTE` de la spec: total `"2850.00"`, hamburguesa sin cebolla ni tomate y papas fritas. */
export function pedidoAPagar(parcial: Partial<PedidoDetalle> = {}): PedidoDetalle {
  return pedidoDto({
    id: 58,
    forma_pago_codigo: 'MERCADOPAGO',
    subtotal: '2800.00',
    costo_envio: '50.00',
    total: '2850.00',
    items: [
      detalleDto({ pedido_id: 58, producto_id: 1, nombre_snapshot: 'Hamburguesa Clásica', subtotal_snapshot: '1500.00', precio_snapshot: '1500.00', personalizacion: [1, 3], personalizacion_snapshot: ['Cebolla', 'Tomate'] }),
      detalleDto({ pedido_id: 58, producto_id: 2, nombre_snapshot: 'Papas fritas', subtotal_snapshot: '1300.00', precio_snapshot: '1300.00' }),
    ],
    ...parcial,
  });
}

export interface OpcionesPago {
  pedidos?: PedidoDetalle[];
  pagos?: Partial<EstadoPagos>;
  ruta?: string;
  /** `null` = visitante sin sesión. */
  sesion?: OpcionesApp['sesion'] | null;
}

/** Renderiza la app en la ruta de pago como un CLIENT, con pedidos y pagos simulados por MSW (el brick lo simula `mp-sdk-doble`). */
export function montarPago({ pedidos = [pedidoAPagar()], pagos, ruta = '/finalizar-compra/pedido/58/pago', sesion = { roles: ['CLIENT'] } }: OpcionesPago = {}) {
  const estadoPedidos: EstadoPedidos = crearEstadoPedidos({ pedidos: new Map(pedidos.map((pedido) => [pedido.id, pedido])) });
  const estadoPagos = crearEstadoPagos(pagos);
  server.use(...handlersPedidos(estadoPedidos), ...handlersPagos(estadoPagos));
  const app = renderApp(ruta, sesion === null ? {} : { sesion });
  return { estadoPedidos, estadoPagos, ...app };
}
