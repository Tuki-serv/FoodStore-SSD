import type { EventoHistorial, PedidoDetalle } from '@/entities/pedido';
import { agregarPedidos, crearEstadoPedidos, detalleDto, handlersPedidos, pedidoDto, type EstadoPedidos } from './msw/pedidos';
import { server } from './msw/server';
import { renderApp, type OpcionesApp } from './render-app';

/** Pedido 58 de la spec: «Ana» `EFECTIVO` `PENDIENTE` por `"3850.00"`, con envío a «Av. Siempre Viva 742, Springfield». */
export function pedido58(parcial: Partial<PedidoDetalle> = {}): PedidoDetalle {
  return pedidoDto({
    id: 58,
    cliente_nombre: 'Ana López',
    created_at: '2026-11-19T15:40:00Z',
    subtotal: '3800.00',
    total: '3850.00',
    notas: 'Tocar timbre 2, el 1 no anda.',
    items: [
      detalleDto({ pedido_id: 58, producto_id: 1, cantidad: 2, nombre_snapshot: 'Hamburguesa Clásica', precio_snapshot: '1500.00', subtotal_snapshot: '3000.00', personalizacion: [1], personalizacion_snapshot: ['Cebolla'] }),
      detalleDto({ pedido_id: 58, producto_id: 5, cantidad: 1, nombre_snapshot: 'Coca-Cola 500ml', precio_snapshot: '800.00', subtotal_snapshot: '800.00' }),
    ],
    ...parcial,
  });
}

/** Pedido 57 de la spec: «Bruno» `MERCADOPAGO` `CONFIRMADO`, para retirar en el local. */
export function pedido57(parcial: Partial<PedidoDetalle> = {}): PedidoDetalle {
  return pedidoDto({
    id: 57,
    cliente_nombre: 'Bruno Díaz',
    usuario_id: 2,
    forma_pago_codigo: 'MERCADOPAGO',
    estado_codigo: 'CONFIRMADO',
    created_at: '2026-11-19T15:31:00Z',
    subtotal: '3800.00',
    total: '3850.00',
    direccion_id: null,
    direccion: null,
    ...parcial,
  });
}

export interface OpcionesGestion {
  pedidos?: PedidoDetalle[];
  historiales?: Record<number, EventoHistorial[]>;
  estado?: Partial<EstadoPedidos>;
  roles?: string[];
}

/** Renderiza la app en una ruta de gestión de pedidos como un usuario con los roles dados, con la red de pedidos simulada. */
export function montarGestion(ruta: string, { pedidos = [pedido58(), pedido57()], historiales = {}, estado: parcial, roles = ['PEDIDOS'] }: OpcionesGestion = {}) {
  const estado = crearEstadoPedidos(parcial);
  agregarPedidos(estado, pedidos, historiales);
  server.use(...handlersPedidos(estado));
  const sesion: OpcionesApp['sesion'] = { roles };
  const app = renderApp(ruta, { sesion });
  return { estado, ...app };
}
